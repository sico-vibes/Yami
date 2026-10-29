// Window layouts for "Arrange" in the Controls card and "snap …" in the
// launcher. The native host does the maths on the window's own monitor.
export const windowLayouts = [
  { id: "left", label: "Left half", icon: "square-split-horizontal" },
  { id: "right", label: "Right half", icon: "square-split-horizontal" },
  { id: "top", label: "Top half", icon: "square-split-vertical" },
  { id: "bottom", label: "Bottom half", icon: "square-split-vertical" },
  { id: "top-left", label: "Top left quarter", icon: "squares-four" },
  { id: "top-right", label: "Top right quarter", icon: "squares-four" },
  { id: "bottom-left", label: "Bottom left quarter", icon: "squares-four" },
  { id: "bottom-right", label: "Bottom right quarter", icon: "squares-four" },
  { id: "left-third", label: "Left third", icon: "columns" },
  { id: "center-third", label: "Middle third", icon: "columns" },
  { id: "right-third", label: "Right third", icon: "columns" },
  { id: "left-two-thirds", label: "Left two thirds", icon: "columns" },
  { id: "right-two-thirds", label: "Right two thirds", icon: "columns" },
  { id: "center", label: "Centred", icon: "frame-corners" },
  { id: "maximize", label: "Maximised", icon: "arrows-out" },
] as const;
export type WindowLayout = (typeof windowLayouts)[number]["id"];
