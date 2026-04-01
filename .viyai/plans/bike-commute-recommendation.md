# Bike Commute Recommendation Plan

## Problem Statement
Add a dedicated commute feature that helps the user decide whether to bike between saved home and work locations now or within the next 2 hours. The recommendation should use a real cycling route, evaluate heavy rain at time-aligned checkpoints along the trip with a ±10 minute buffer, explain which part of the route is risky, and show the route over the radar map.

## Appetite
Medium feature for a single repo, implemented as a new page behind a button.

## Scope
- In: New commute entry point and dedicated page, persisted home/work commute settings, real cycling route fetch with ETA, checkpoint-based recommendation engine for now and next 2 hours, explanation of risky route segment(s), route overlay on radar map, caching/resilience for new API usage
- Out: Full multi-commute management, calendar/scheduled arrival workflows, alternative transport modes, user-configurable rain thresholds, backend/proxy infrastructure

## Success Criteria
- User can save home and work locations.
- User can open a commute page from the existing app.
- App fetches a cycling route and estimated duration between endpoints.
- App evaluates departures now and over the next 2 hours.
- App recommends bike now, wait until a better slot, or don’t bike in the next 2 hours.
- App explains which route portion/checkpoint is risky.
- Map displays the route over radar on the commute page.

## Approach
Use a dedicated commute domain layered on top of the existing weather app: a new persisted commute store for endpoints and preferences, a routing service for cycling geometry + duration, a commute recommendation service that generates time-based checkpoints, aligns projected arrival times, and evaluates heavy rain with the app’s existing threshold logic centralized into a shared precipitation utility, and a new commute page that presents recommendation, explanation, and route-over-radar map.

Why alternatives were rejected:
- Full route sampling: more precise, but too heavy for a frontend-only v1.
- Endpoint-only scoring: easier, but too weak for “anywhere on the route.”
- Embedding commute into the current home screen: lower UX clarity than a distinct feature page.

## Rabbit Holes
- Routing API choice and quota
  - Mitigation: isolate behind a service and cache responses.
- Route-level rain fidelity
  - Mitigation: make checkpoint heuristic explicit and conservative.
- Stale forecast data for leave-now recommendations
  - Mitigation: surface freshness and prefer live refresh before scoring.
- Radar overlay vs recommendation mismatch
  - Mitigation: treat radar as visual context; checkpoint scoring is the source of truth.
- Single-location app assumptions in current architecture
  - Mitigation: keep commute state in a dedicated store instead of overloading location state.

## Steps
1. [ ] Define commute domain and external service seams
   - Files: `src/types/weather.ts` or new commute types file, new routing service file, new precipitation utility file
   - Done when: route shape, checkpoint shape, recommendation result shape, and centralized heavy-rain classification are clearly modeled for reuse
2. [ ] Add persisted commute settings
   - Files: new commute store in `src/stores/`, reuse/adapt `src/components/LocationSearch.vue`
   - Done when: user can save home/work endpoints and retrieve them after reload
3. [ ] Implement routing integration
   - Files: new routing service, store/service wiring
   - Done when: app can fetch cycling geometry, duration, and route bounds for home/work trips
4. [ ] Build checkpoint recommendation engine
   - Files: new commute recommendation service/util, precipitation utility, related types/store wiring
   - Done when: departures now and across next 2 hours are scored using start/quarter/mid/three-quarter/finish checkpoints with expansion for longer trips and ±10 minute buffers
5. [ ] Build commute page UI and entry point
   - Files: `src/App.vue`, new commute page/component(s)
   - Done when: user can open the commute feature from a button and see settings, recommendation, and explanation
6. [ ] Extend map experience for commute view
   - Files: `src/components/RadarMap.vue` or new commute map sibling component
   - Done when: cycling route is rendered over radar and risky route segments/checkpoints are visually called out
7. [ ] Add caching, freshness, and degraded-state handling
   - Files: `vite.config.ts`, relevant stores/services/UI messaging
   - Done when: routing API is cached appropriately, stale recommendation states are handled, and offline/failed fetch behavior is clear
8. [ ] Validate cycling ETA assumptions from the routing backend
   - Files: `src/services/routingService.ts`, commute recommendation UI/docs if needed
   - Done when: the routing backend's cycling time assumptions are understood and any needed user-facing explanation or tuning follow-up is documented

## Clarity Scores
- Gate 1 (Problem): 0.89 (Goal: 0.95, Constraint: 0.90, Success Criteria: 0.90, Code Context: 0.85)
- Gate 2 (Solution): 0.89 (Approach: 0.92, Feasibility: 0.87, Step: 0.90, Risk: 0.86)
