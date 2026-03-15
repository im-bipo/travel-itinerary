<div align="center">
  <img src="public/travel-itinerary.png" alt="Travel Itinerary Logo" width="240" />

  <h1>Travel Itinerary</h1>

  <p style="max-width: 680px; margin: 0 auto;">
    A travel planning platform built with Next.js, TypeScript, Tailwind CSS, Prisma, and vector search. It combines streaming AI responses, retrieval-augmented recommendations, and algorithmic route optimization into one workflow.
  </p>

[![View Demo](https://img.shields.io/badge/View%20Demo-%F0%9F%8E%9A-blue?style=for-the-badge&logo=vimeo&logoColor=white)](https://player.vimeo.com/video/1173750860)

</div>

---

## Travel Itinerary Core

Travel Itinerary is designed to be a full-stack, end-to-end travel planning experience with three tightly integrated layers:

- **Conversational AI Planner**: Users ask questions in natural language and receive streamed, context-aware travel recommendations. The system uses Retrieval-Augmented Generation (RAG) to ground responses in actual place data.
- **Local Guide Content**: Contributors can add verified places through a guided form and map picker. New places are stored in PostgreSQL and indexed into Astra for instant retrieval.
- **Route Optimization Engine**: Selected places are turned into an optimized itinerary using OSRM road distances and a Branch-and-Bound solver, with multiple visualization layers highlighting the route decisions.

![Travel Itinerary Cover](public/Travel%20Itinerary%20Cover.png)

---

## At a Glance

- AI planner with streaming responses (token-by-token UX)
- RAG-powered recommendations using Astra vector search + Gemini embeddings
- Local guide console to add trusted places with map-picked coordinates
- Route optimization with Branch-and-Bound and live algorithm visualization
- Interactive graph + map views for route understanding

## Tech Stack

| Layer         | Technology                                        |
| ------------- | ------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript     |
| Styling       | Tailwind CSS v4                                   |
| UI Utilities  | Lucide Icons, React Markdown, XYFlow (React Flow) |
| Maps          | Leaflet + React Leaflet, OSRM                     |
| Backend       | Next.js Route Handlers + Server Actions           |
| AI Model      | AWS Nova (OpenAI-compatible endpoint)             |
| Embeddings    | Google Gemini Embedding (`gemini-embedding-001`)  |
| Vector Search | DataStax Astra DB                                 |
| Database      | PostgreSQL + Prisma                               |
| Tooling       | ESLint, pnpm                                      |

## Core User Workflow

1. User asks a travel question in the Planner.
2. Backend detects if query is place-related.
3. If place-related, query is embedded and matched in Astra vector DB.
4. Retrieved places are injected into a contextual prompt.
5. Nova streams the response back as NDJSON chunks.
6. User selects recommended places.
7. Route page loads selected place details and road-distance matrix.
8. Branch-and-Bound computes optimal visiting order.
9. Route is presented in graph, algorithm tree, and map flow views.

## Feature Modules

### 1) AI Planner (Streaming + RAG)

- Planner client sends message and recent chat history to `/api/chat/stream`.
- Route handler classifies query intent using travel/place keyword matching.
- Relevant queries trigger embedding generation and vector similarity search.
- Server streams AI output as NDJSON (`chunk`, `meta`, `done`, `error`).
- Client renders markdown incrementally and displays matched place sources.

![Planner Chat](public/screenshots/planner-chat.png)
_Example: Planner chat stream with RAG results on the right._

### 2) Local Guide Place Publishing

- Local guide page allows admins/contributors to submit new places.
- Coordinates can be chosen visually from an interactive map.
- Submission is stored in PostgreSQL via Prisma.
- The same place is embedded and indexed into Astra for future RAG retrieval.

![Local Guide Form](public/screenshots/local-guide-form.png)
_Example: Local Guide form for submitting a place with coordinates and category._

### 3) Route Planning + Optimization

- Selected places are shared via React Context between planner and route pages.
- Route page fetches full place details and builds graph nodes.
- Distance matrix is fetched from OSRM table endpoint (road distances between all points).
- Branch-and-Bound computes a minimum-cost route from selected start to end.
- Output is shown in:
  - Route graph (pairwise edge distances)
  - Live Branch-and-Bound tree (expanded/pruned/solution states)
  - Route flow map (ordered path segments)
  - OSRM distance table and network graph (for route feasibility checks)

## Route Visualization (Maps & Graphs)

Each visualization helps explain a different part of the route optimization pipeline.

### Route Flow Map

![Route Flow Map](public/screenshots/route-flow-map.png)
_Example: Route Flow Map showing the final ordered path on a Leaflet map._

This map is rendered in `app/route/components/RouteFlowMap.tsx`.
It renders the final itinerary path by fetching OSRM routing segments for each leg of the ordered route.
When OSRM returns invalid segments, the component falls back to straight-line connections while still showing the full route.

### Branch-and-Bound Tree

![Branch and Bound Tree](public/screenshots/branch-and-bound-tree.png)
_Example: Live Branch-and-Bound visualization showing explored and pruned branches._

This visualization is rendered in `app/route/components/BranchAndBoundTree.tsx`.
It shows each search node (partial route) as a tree node, with colors indicating:

- **Expanded** (active search)
- **Pruned** (discarded due to bound)
- **Solution** (best path found so far)

### OSRM Distance Table

![OSRM Distance Table](public/screenshots/osrm-distance-table.png)
_Example: OSRM distance matrix table used for route cost calculations._

This table is generated by `app/api/route/osrm-table/route.ts`.
It calls OSRM’s `/table` endpoint to compute road distances between all selected points, then validates results by comparing against straight-line distances so the optimizer avoids bad routing cases.

### OSRM Network Graph

![OSRM Network Graph](public/screenshots/osrm-network-graph.png)
_Example: OSRM network graph visualization used to validate road connectivity._

This graph view (rendered in `app/route/components/RouteGraph.tsx`) overlays the computed edge distances on a point graph.
Edges are annotated with distance labels, and the graph is used to help users understand why the optimizer chooses the route it does.

## Routing Algorithm (Moderate Technical View)

The route engine uses a Branch-and-Bound approach tailored for practical itinerary ordering:

- **State**: partial path, accumulated cost, optimistic lower bound
- **Branching**: expand next unvisited intermediate nodes
- **Bounding**: estimate best possible completion cost for each partial path
- **Pruning rule**: discard branches whose bound is already worse than current best
- **Search order**: best-first by smallest bound

Why this works well here:

- Exact enough for small/medium trip node counts
- Efficient due to aggressive pruning
- Easy to visualize for demos and explainability

## Project Structure

```text
app/
  api/
    chat/stream/route.ts         # Streaming AI + RAG endpoint
    route/osrm-table/route.ts    # Distance matrix endpoint
  planner/page.tsx               # AI planner UI
  route/page.tsx                 # Route optimization UI
  local-guide/page.tsx           # Place publishing UI
  context/SelectedPlacesContext.tsx

actions/
  search.ts                      # Vector search action
  place.ts                       # Add place + vector index action
  getPlacesByIds.ts              # Fetch full place details

lib/
  nova.ts                        # Nova client (sync + stream)
  gemini.ts                      # Embedding client
  astra.ts                       # Astra vector operations
  branch-and-bound-core.ts       # Core optimization algorithm
  branch-and-bound.ts            # Trace-enabled variant for UI tree
  db.ts                          # Prisma/PostgreSQL client

prisma/
  schema.prisma                  # Place model
```

## Quick Start

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp example.env .env
```

Required environment variables:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `NOVA_API_KEY`
- `ASTRA_DB_APPLICATION_TOKEN`
- `ASTRA_DB_KEYSPACE`
- `ASTRA_API_ENDPOINT`

### 3. Run database and app

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Open http://localhost:3000

## Useful Commands

```bash
pnpm dev             # Start development server
pnpm build           # Build for production
pnpm start           # Start production server
pnpm prisma:studio   # Open Prisma Studio
```
