/**
 * A small diagram of how to lay the hand out for the photo: concealed tiles in the top row,
 * exposed melds in a row below, flowers and seasons off to the side (ADR-41).
 */
export function LayoutGuide() {
  return (
    <figure aria-label="How to lay out your hand" className="flex flex-col gap-2">
      <div className="border-border bg-muted/40 flex gap-3 rounded-lg border p-3">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className="bg-foreground/20 h-8 flex-1 rounded-sm" />
              ))}
            </div>
            <span className="text-sm">Concealed tiles in one row, left to right</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, g) => (
                <div key={g} className="flex flex-1 gap-1">
                  {Array.from({ length: 3 }, (_, i) => (
                    <span key={i} className="bg-foreground/20 h-8 flex-1 rounded-sm" />
                  ))}
                </div>
              ))}
            </div>
            <span className="text-sm">Exposed melds in a second row, groups apart</span>
          </div>
        </div>
        <div className="flex w-14 flex-col gap-1">
          <div className="flex flex-wrap gap-1" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="bg-foreground/20 h-8 w-6 rounded-sm" />
            ))}
          </div>
          <span className="text-sm">Flowers to the side</span>
        </div>
      </div>
      <figcaption className="text-muted-foreground text-sm">
        Good light, all tiles face up, nothing overlapping.
      </figcaption>
    </figure>
  );
}
