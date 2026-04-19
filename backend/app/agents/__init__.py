"""
Invest UAE — AI Agent Modules

Open-source ML agents for investment signal detection.
Each agent is a self-contained module that can run independently
or be orchestrated together through the pipeline.

Agents:
  - EmbeddingAgent: Semantic similarity & relevance scoring (sentence-transformers)
  - ClassifierAgent: Zero-shot signal type classification (transformers)
  - EntityAgent: Named entity & funding extraction (regex + heuristics)
  - ScoringAgent: Multi-factor investability & UAE alignment scoring
  - Orchestrator: Coordinates all agents into a unified pipeline
"""

from app.agents.embedding_agent import EmbeddingAgent
from app.agents.classifier_agent import ClassifierAgent
from app.agents.entity_agent import EntityAgent
from app.agents.scoring_agent import ScoringAgent

__all__ = [
    "EmbeddingAgent",
    "ClassifierAgent",
    "EntityAgent",
    "ScoringAgent",
]
