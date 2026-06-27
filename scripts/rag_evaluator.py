"""
RAG Evaluator — Faithfulness + Relevance Scoring
================================================
RAGAS-style evaluation using cosine similarity.
No external API needed — fully local, works with any embedding model.

Metrics:
  - Context Relevance: how relevant retrieved chunks are to the query
  - Answer Faithfulness: how grounded the answer is in the retrieved context
  - Answer Relevance: how well the answer addresses the original question

Usage:
  python scripts/rag_evaluator.py --query "What is the capital of France?" \
      --answer "The capital of France is Paris." \
      --contexts "France is a country in Western Europe. Its capital is Paris."

  # Or run built-in benchmark suite:
  python scripts/rag_evaluator.py --benchmark
"""

import argparse
import json
import logging
import time
from dataclasses import dataclass, asdict
from typing import List, Optional
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class EvaluationResult:
    query: str
    answer: str
    context_relevance: float       # 0..1  — how relevant the retrieved chunks are
    answer_faithfulness: float     # 0..1  — how grounded the answer is in context
    answer_relevance: float        # 0..1  — how well the answer addresses the query
    overall_score: float           # weighted average
    evaluation_time_s: float
    num_context_chunks: int

    def to_dict(self) -> dict:
        return asdict(self)

    def summary(self) -> str:
        grade = (
            "A" if self.overall_score >= 0.85 else
            "B" if self.overall_score >= 0.70 else
            "C" if self.overall_score >= 0.55 else
            "D" if self.overall_score >= 0.40 else
            "F"
        )
        return (
            f"Grade: {grade} ({self.overall_score:.2%})\n"
            f"  Context Relevance : {self.context_relevance:.2%}\n"
            f"  Answer Faithfulness: {self.answer_faithfulness:.2%}\n"
            f"  Answer Relevance   : {self.answer_relevance:.2%}\n"
            f"  Chunks evaluated   : {self.num_context_chunks}\n"
            f"  Evaluation time    : {self.evaluation_time_s:.2f}s"
        )


# ---------------------------------------------------------------------------
# Embedding helper (lazy-loaded so the module can be imported without GPU)
# ---------------------------------------------------------------------------

class _EmbeddingHelper:
    """Thin wrapper around sentence-transformers for evaluation purposes."""

    _instance: Optional["_EmbeddingHelper"] = None

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        logger.info(f"Loading evaluation embedding model: {model_name}")
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(model_name)
            self.model_name = model_name
            logger.info("Embedding model loaded")
        except ImportError:
            raise ImportError(
                "sentence-transformers is required for RAG evaluation.\n"
                "Install with: pip install sentence-transformers"
            )

    @classmethod
    def get(cls, model_name: str = "all-MiniLM-L6-v2") -> "_EmbeddingHelper":
        if cls._instance is None:
            cls._instance = cls(model_name)
        return cls._instance

    def embed(self, texts: List[str]) -> np.ndarray:
        """Return L2-normalized embeddings as numpy array, shape (N, D)."""
        embs = self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        return embs  # already normalized → cosine = dot product

    def cosine_sim(self, a: str, b: str) -> float:
        embs = self.embed([a, b])
        return float(np.dot(embs[0], embs[1]))

    def cosine_sim_batch(self, query: str, candidates: List[str]) -> List[float]:
        if not candidates:
            return []
        all_texts = [query] + candidates
        embs = self.embed(all_texts)
        q_emb = embs[0]
        return [float(np.dot(q_emb, c)) for c in embs[1:]]


# ---------------------------------------------------------------------------
# Core metric functions
# ---------------------------------------------------------------------------

def compute_context_relevance(
    query: str,
    contexts: List[str],
    embedder: _EmbeddingHelper,
) -> float:
    """
    Measures how relevant the retrieved chunks are to the query.

    Method:
      For each sentence in each context chunk, compute cosine similarity
      with the query embedding. The score is the average of top-K sentence
      similarities (K = min(3, n_sentences)).

    Returns:
      Float in [0, 1]
    """
    if not contexts:
        return 0.0

    all_sentences: List[str] = []
    for ctx in contexts:
        sents = [s.strip() for s in ctx.replace("\n", " ").split(".") if len(s.strip()) > 20]
        all_sentences.extend(sents[:20])  # cap per chunk

    if not all_sentences:
        # Fall back to chunk-level similarity
        scores = embedder.cosine_sim_batch(query, contexts)
        return float(np.mean(scores))

    sims = embedder.cosine_sim_batch(query, all_sentences)
    # Mean of top-3 sentence similarities
    top_k = min(3, len(sims))
    top_sims = sorted(sims, reverse=True)[:top_k]
    return float(np.mean(top_sims))


def compute_answer_faithfulness(
    answer: str,
    contexts: List[str],
    embedder: _EmbeddingHelper,
) -> float:
    """
    Measures how grounded the answer is in the retrieved context.

    Method:
      Split the answer into sentences. For each answer sentence,
      find its best-matching context sentence. The faithfulness score
      is the average of these best matches.

    A score near 1.0 means all answer claims are supported by context.
    A low score suggests potential hallucination.

    Returns:
      Float in [0, 1]
    """
    if not contexts or not answer:
        return 0.0

    answer_sents = [s.strip() for s in answer.split(".") if len(s.strip()) > 15]
    if not answer_sents:
        return embedder.cosine_sim(answer, " ".join(contexts))

    context_blob = " ".join(contexts)
    context_sents = [
        s.strip()
        for s in context_blob.replace("\n", " ").split(".")
        if len(s.strip()) > 10
    ][:60]  # cap to avoid huge embedding batch

    if not context_sents:
        sims = embedder.cosine_sim_batch(answer, contexts)
        return float(np.mean(sims))

    # For each answer sentence, find max similarity to any context sentence
    best_sims: List[float] = []
    for a_sent in answer_sents:
        sims = embedder.cosine_sim_batch(a_sent, context_sents)
        best_sims.append(max(sims) if sims else 0.0)

    return float(np.mean(best_sims))


def compute_answer_relevance(
    query: str,
    answer: str,
    embedder: _EmbeddingHelper,
) -> float:
    """
    Measures how well the answer addresses the original question.

    Method:
      Direct cosine similarity between the query embedding and
      the answer embedding. Simple but effective for checking
      whether the answer is on-topic.

    Returns:
      Float in [0, 1]
    """
    return embedder.cosine_sim(query, answer)


# ---------------------------------------------------------------------------
# Main evaluator class
# ---------------------------------------------------------------------------

class RAGEvaluator:
    """
    End-to-end RAG evaluation without external APIs.

    Example
    -------
    evaluator = RAGEvaluator()
    result = evaluator.evaluate(
        query="What is Paris known for?",
        answer="Paris is the capital of France, famous for the Eiffel Tower.",
        contexts=["France's capital Paris is home to the iconic Eiffel Tower..."],
    )
    print(result.summary())
    """

    WEIGHTS = {
        "context_relevance": 0.30,
        "answer_faithfulness": 0.40,
        "answer_relevance": 0.30,
    }

    def __init__(self, embedding_model: str = "all-MiniLM-L6-v2"):
        self.embedder = _EmbeddingHelper.get(embedding_model)
        logger.info(
            f"RAGEvaluator ready (model={embedding_model}, "
            f"weights={self.WEIGHTS})"
        )

    def evaluate(
        self,
        query: str,
        answer: str,
        contexts: List[str],
    ) -> EvaluationResult:
        """
        Evaluate a single RAG response.

        Args:
            query:    The user's original question
            answer:   The LLM-generated answer
            contexts: List of retrieved document chunks used to generate the answer

        Returns:
            EvaluationResult with individual metric scores and overall grade
        """
        t0 = time.time()

        ctx_rel = compute_context_relevance(query, contexts, self.embedder)
        ans_faith = compute_answer_faithfulness(answer, contexts, self.embedder)
        ans_rel = compute_answer_relevance(query, answer, self.embedder)

        overall = (
            self.WEIGHTS["context_relevance"] * ctx_rel
            + self.WEIGHTS["answer_faithfulness"] * ans_faith
            + self.WEIGHTS["answer_relevance"] * ans_rel
        )

        return EvaluationResult(
            query=query,
            answer=answer,
            context_relevance=ctx_rel,
            answer_faithfulness=ans_faith,
            answer_relevance=ans_rel,
            overall_score=overall,
            evaluation_time_s=time.time() - t0,
            num_context_chunks=len(contexts),
        )

    def evaluate_batch(
        self,
        samples: List[dict],
    ) -> List[EvaluationResult]:
        """
        Evaluate a batch of samples.

        Each sample dict must have keys: query, answer, contexts (list of str).

        Returns:
            List of EvaluationResult
        """
        results = []
        for i, sample in enumerate(samples, 1):
            logger.info(f"Evaluating sample {i}/{len(samples)}: {sample['query'][:60]}...")
            result = self.evaluate(
                query=sample["query"],
                answer=sample["answer"],
                contexts=sample.get("contexts", []),
            )
            results.append(result)
        return results

    def print_report(self, results: List[EvaluationResult]) -> None:
        """Print a formatted evaluation report to stdout."""
        print("\n" + "=" * 70)
        print("  RAG-Local-Pro — Evaluation Report")
        print("=" * 70)

        scores = {
            "context_relevance": [],
            "answer_faithfulness": [],
            "answer_relevance": [],
            "overall_score": [],
        }

        for i, r in enumerate(results, 1):
            print(f"\n[{i}] Query: {r.query[:60]}...")
            print(r.summary())
            for k in scores:
                scores[k].append(getattr(r, k))

        print("\n" + "-" * 70)
        print("  AGGREGATE SCORES")
        print("-" * 70)
        for k, vals in scores.items():
            avg = np.mean(vals)
            label = k.replace("_", " ").title()
            print(f"  {label:<28} {avg:.2%}")
        print("=" * 70 + "\n")


# ---------------------------------------------------------------------------
# Built-in benchmark suite
# ---------------------------------------------------------------------------

BENCHMARK_SAMPLES = [
    {
        "query": "What is Retrieval-Augmented Generation?",
        "answer": (
            "Retrieval-Augmented Generation (RAG) is an AI framework that combines "
            "a retrieval mechanism with a large language model. It first retrieves "
            "relevant documents from a knowledge base, then uses them as context "
            "when generating an answer, reducing hallucinations."
        ),
        "contexts": [
            "RAG stands for Retrieval-Augmented Generation. It is an AI paradigm "
            "that retrieves relevant documents from an external knowledge base and "
            "augments the LLM prompt with this context before generating a response.",
            "By grounding the LLM in retrieved documents, RAG significantly reduces "
            "hallucinations compared to pure parametric memory approaches.",
        ],
    },
    {
        "query": "What embedding model does the system use?",
        "answer": (
            "The system uses BAAI/bge-m3, a multilingual state-of-the-art embedding "
            "model with 1024-dimensional vectors. It supports dense, sparse, and "
            "ColBERT-style retrieval."
        ),
        "contexts": [
            "Embedding model: BAAI/bge-m3 — a multilingual model from BAAI. "
            "It produces 1024-dimensional embeddings and supports three retrieval "
            "paradigms: dense, sparse, and multi-vector ColBERT.",
        ],
    },
    {
        "query": "How does the chunking strategy work?",
        "answer": (
            "The system splits documents using RecursiveCharacterTextSplitter with "
            "a chunk size of 1000 characters and an overlap of 100 characters. "
            "The separators are paragraph breaks, newlines, periods, and spaces."
        ),
        "contexts": [
            "Documents are split using LangChain's RecursiveCharacterTextSplitter. "
            "The default configuration uses chunk_size=1000, overlap=100, and "
            "separators=['\n\n', '\n', '.', ' ', ''].",
        ],
    },
    {
        "query": "How is GPU memory managed during inference?",
        "answer": (
            "The embeddings service automatically falls back to CPU if CUDA errors "
            "occur. After a 60-second cooldown period it attempts to restore GPU "
            "operation. After each batch, torch.cuda.empty_cache() is called."
        ),
        "contexts": [
            "The EmbeddingsService implements automatic GPU fallback. When a CUDA "
            "RuntimeError is detected (e.g., out-of-memory), the model is reloaded "
            "on CPU. After GPU_RETRY_INTERVAL seconds (default 60), the system "
            "attempts to reload on GPU. torch.cuda.empty_cache() is called after "
            "each embedding batch.",
        ],
    },
    {
        "query": "What is the relevance threshold for retrieval?",
        "answer": (
            "The default relevance threshold is 0.30. This means only chunks with "
            "a cosine similarity score above 0.30 are returned. The threshold can "
            "be configured via the RELEVANCE_THRESHOLD environment variable."
        ),
        "contexts": [
            "Qdrant search is performed with a score_threshold equal to "
            "RELEVANCE_THRESHOLD (default 0.30). Chunks below this threshold are "
            "filtered out upstream in Qdrant before being passed to the LLM.",
            "The RELEVANCE_THRESHOLD can be set in the .env file. Lowering it "
            "increases recall but may introduce noisy context.",
        ],
    },
]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Evaluate RAG quality with faithfulness + relevance metrics"
    )
    p.add_argument("--query", help="Query string")
    p.add_argument("--answer", help="LLM-generated answer")
    p.add_argument(
        "--contexts",
        nargs="+",
        help="One or more retrieved context chunks",
    )
    p.add_argument(
        "--benchmark",
        action="store_true",
        help="Run built-in benchmark suite (ignores --query/--answer/--contexts)",
    )
    p.add_argument(
        "--embedding-model",
        default="all-MiniLM-L6-v2",
        help="Sentence-Transformers model name for evaluation (default: all-MiniLM-L6-v2)",
    )
    p.add_argument(
        "--output-json",
        help="Optional path to write JSON results",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    evaluator = RAGEvaluator(embedding_model=args.embedding_model)

    if args.benchmark:
        results = evaluator.evaluate_batch(BENCHMARK_SAMPLES)
        evaluator.print_report(results)
        if args.output_json:
            with open(args.output_json, "w") as f:
                json.dump([r.to_dict() for r in results], f, indent=2)
            logger.info(f"Results written to {args.output_json}")
        return

    if not args.query or not args.answer or not args.contexts:
        print("ERROR: Provide --query, --answer, and --contexts (or use --benchmark)")
        raise SystemExit(1)

    result = evaluator.evaluate(
        query=args.query,
        answer=args.answer,
        contexts=args.contexts,
    )
    print(result.summary())

    if args.output_json:
        with open(args.output_json, "w") as f:
            json.dump(result.to_dict(), f, indent=2)
        logger.info(f"Result written to {args.output_json}")


if __name__ == "__main__":
    main()
