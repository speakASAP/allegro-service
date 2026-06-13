# Project Graph Schema

```yaml
id: GRAPH-SCHEMA-ALLEGRO-SERVICE
status: draft
owner: Project Owner
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
upstream:
  - ../00_constitution/CONSTITUTION.md
downstream:
  - ./project_graph.example.yaml
related_adrs: []
```

## Purpose

Defines the lightweight graph fields used to trace IPS artifacts in `allegro-service`.

## Node Fields

- id
- type
- path
- title

## Edge Fields

- from
- to
- relationship

## Validation

The example graph must include the path from vision to validation for TASK-001.
