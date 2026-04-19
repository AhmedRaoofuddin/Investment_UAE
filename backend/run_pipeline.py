"""
Run the live signal detection pipeline using open-source ML agents.

This script:
  1. Fetches real articles from 18+ RSS sources
  2. Processes them through the ML agent pipeline
  3. Saves results to the cache file for the API to serve

Usage:
  python run_pipeline.py
"""
import asyncio
import json
import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("pipeline_runner")


async def main():
    from app.services.rss_aggregator import fetch_all_articles
    from app.agents.orchestrator import PipelineOrchestrator
    from app.services.pipeline_cache import cache

    logger.info("=" * 60)
    logger.info("Invest UAE — Live Signal Detection Pipeline")
    logger.info("=" * 60)

    # Stage 1: Fetch articles
    logger.info("Stage 1: Fetching articles from RSS sources...")
    started = time.perf_counter()
    articles = await fetch_all_articles()
    fetch_time = time.perf_counter() - started
    logger.info("Fetched %d articles in %.1fs", len(articles), fetch_time)

    if not articles:
        logger.error("No articles fetched. Check network/feeds.")
        sys.exit(1)

    # Show sample
    logger.info("Sample articles:")
    for a in articles[:3]:
        logger.info("  [%s] %s", a.source_name, a.title[:70])
        logger.info("    URL: %s", a.url[:80])

    # Stage 2: Run agent pipeline
    logger.info("")
    logger.info("Stage 2: Running ML agent pipeline...")
    orchestrator = PipelineOrchestrator()
    pipeline_start = time.perf_counter()
    companies = await orchestrator.run(articles, relevance_threshold=0.15, max_companies=120)
    pipeline_time = time.perf_counter() - pipeline_start
    logger.info("Pipeline produced %d companies in %.1fs", len(companies), pipeline_time)

    if not companies:
        logger.warning("No companies extracted. The pipeline may need tuning.")
        # Fall back to simpler keyword-based extraction
        logger.info("Falling back to keyword-only extraction...")
        orchestrator_lite = PipelineOrchestrator(mode="lite")
        companies = await orchestrator_lite.run(articles, relevance_threshold=0.1, max_companies=120)
        pipeline_time = time.perf_counter() - pipeline_start
        logger.info("Lite pipeline produced %d companies", len(companies))

    # Stage 3: Save to cache
    total_ms = int((time.perf_counter() - started) * 1000)
    await cache.set(companies, total_ms)
    logger.info("")
    logger.info("Stage 3: Cache saved (%d companies, %dms)", len(companies), total_ms)

    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("Pipeline Complete!")
    logger.info("  Companies: %d", len(companies))
    logger.info("  Total signals: %d", sum(len(c.signals) for c in companies))
    logger.info("  Sources: %d unique articles", len(articles))
    logger.info("  Elapsed: %.1fs", total_ms / 1000)
    logger.info("=" * 60)

    # Print top 10
    logger.info("")
    logger.info("Top 10 companies:")
    for i, c in enumerate(companies[:10], 1):
        avg = (c.investability_score + c.uae_alignment_score) / 2
        signals = len(c.signals)
        logger.info(
            "  %2d. %-30s score=%.0f  signals=%d  sectors=%s",
            i, c.name[:30], avg, signals,
            ", ".join(s.value for s in c.sectors[:3]),
        )
        for s in c.signals[:2]:
            logger.info("      -> [%s] %s", s.type.value, s.headline[:60])
            logger.info("         Source: %s", s.source.url[:70])


if __name__ == "__main__":
    asyncio.run(main())
