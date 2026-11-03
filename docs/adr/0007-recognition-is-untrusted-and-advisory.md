# 0007. Recognition is an untrusted, stateless, advisory subsystem

Status: Accepted

## Context

Photo recognition is the product's differentiator and its riskiest dependency. A vision model can misread dim or angled tiles, refuse, truncate its output, or in principle be steered by text in a photo. It is also paid and external.

## Decision

Recognition is one stateless request whose result is only ever a suggestion.

1. **Phone.** The image is resized to 1568 px on the long edge, encoded as JPEG at 0.85, and EXIF (including GPS) is stripped. One request is in flight at a time.
2. **Server.** Request checks, a model call, and re-validation ([0008](0008-recognition-request-pipeline.md)).
3. **One schema.** The model returns `isMahjongHand`, `concealed`, `melds`, `bonus` and `uncertain` positions. The same Zod schema generates the JSON Schema sent to the model and parses what comes back.
4. **Validate again.** Require a clean stop (`finishReason` of `STOP`), normalise casing, parse with Zod, enforce at most four copies of any tile and reject a repeated bonus tile. A wrong tile count becomes a warning, not an error.
5. **Review.** A draft is built with exposed melds and no winning tile. Uncertain positions are highlighted. The engine re-scores on every correction, and nothing changes until the player confirms.
6. **Failure.** After one retry, the app falls back to the manual picker with the photo beside it.

The model supplies tile identities only. Exposed versus concealed, the winning tile and the self-drawn and special flags come from the player.

## Alternatives considered

- **Letting the model decide flags or the winning tile.** It cannot see them.
- **Free-form model text parsed with regexes.** Fragile and injectable.
- **Storing photos for debugging or training.** Breaks the privacy promise.
- **An on-device detector first.** Needs training data the project does not have; an API call validates the camera flow first.

## Consequences

- A structured-output constraint guarantees parseable JSON, not a sound answer, so the server re-validates with the same schema. The model has no tools, and nothing it returns is executed or rendered as HTML.
- Asking the model to flag what it is unsure of points the player at the one or two tiles worth checking.
- Statelessness is the privacy mechanism. Photos are processed in memory and never written to disk or logs.
- Recognition failure never blocks play. The manual picker is the same screen as review.
- The review step costs the player a glance at every photographed hand. That cost is deliberate.
- Dependence on an external provider's availability, pricing and model lifecycle. The single retry goes to a fallback model for 429 and 5xx responses, so a demand spike on the primary does not become an outage.
