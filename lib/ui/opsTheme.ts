export const OPS = {
  bg:        "#0A0E13",   // canvas
  panel:     "#0E141B",   // panel fill
  panelAlt:  "#121A22",   // row alt / header
  line:      "#1E2A35",   // hairline border
  grid:      "#16212B",   // graticule
  text:      "#C9D4DF",   // primary value
  textDim:   "#7C8B99",   // label
  textFaint: "#4C5866",   // meta / provenance
  // state colors — ONLY these carry hue
  safe:      "#4A9E7F",   // desaturated, not mint
  caution:   "#C8952E",   // close pass < 5 LD
  hazard:    "#C24A3E",   // PHA
  accent:    "#5A8FB8",   // selection / focus only
  moon:      "#8A94A0",
} as const;

export const OPS_TYPE = {
  label: "text-[10px] tracking-[0.14em] uppercase font-medium",
  value: "text-[13px] font-mono tabular-nums",
  valueLg: "text-[18px] font-mono tabular-nums",
  meta: "text-[10px] font-mono tabular-nums",
} as const;
