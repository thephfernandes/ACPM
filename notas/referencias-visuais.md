<!-- Visual references for the production-line redesign. Written by the orchestrator from the two screenshots Pedro
     sent on 2026-11-21. Structure only: the screenshots themselves are NOT in the repo and must never be added to it
     (the first one shows work e-mail). Local working note: never commit this file. -->

# Visual references

Both references are dark-theme screenshots. They show **structure, not colours**: the app keeps its own light and dark
tokens from `css/app.css`.

## 1. Three-pane mail client (the layout of every screen)

A window split into three vertical panes with small gaps between them, each pane a rounded dark surface.
Measured on the screenshot (1,400 px wide): left pane about 32% (0–448 px), middle about 46% (458–1,096 px), right rail
about 21% (1,106–1,400 px).

### Left pane: the list
- **Top bar of the pane:** at the left, a pill-shaped segmented control with two options (one active, filled with the
  accent colour, the other plain text on the darker pill). At the far right, a small filter icon (three stacked lines of
  decreasing width). Nothing else in this bar.
- **A group header** under it: a chevron pointing down and a small muted label ("Today"), acting as a collapsible group.
- **Rows:** tightly stacked, separated by a one-pixel hairline, with no card or border around each row and no gap
  between rows. Row height is about 72–80 px for a three-line row.
  - Far left: a small filled dot in the accent colour (about 8 px) marking the row's status (unread). Rows without the
    status have no dot, and the space stays.
  - Then a round avatar, about 28 px: initials on a coloured disc (one or two letters, a different hue per person), or a
    photo.
  - Then up to three lines of text:
    1. the name: the largest text of the row, semibold, in the main text colour, cut with an ellipsis;
    2. a second line in the **accent colour**, semibold, cut with an ellipsis, with a small **right-aligned meta** on
       the same line (a time such as 17:34), also in the accent colour;
    3. a third line in the muted colour, regular weight, cut with an ellipsis.
  - Small icons at the right end of the first line (a paperclip-like link icon, a calendar icon, a red exclamation mark
    for importance) and, after the name, a small rounded count badge ("5", "2") when the row groups several items.
  - Some rows have a chevron at the far left (before the dot) that expands the row's group.
  - Some rows carry an **inline sub-block** under their three lines: a round icon, two short lines (a date and time; a
    one-line state such as "no conflicts" or "canceled") and one small right-aligned text action in the accent colour.
- **The selected row** has a lighter grey background across the full width of the pane (edge to edge, no rounded
  card), and nothing else changes in it.
- The list scrolls on its own; the top bar of the pane stays.

### Middle pane: the detail
- **Title row:** a large title at the top-left (about 18–20 px, semibold, wrapping to two lines), with **icon actions at
  its right** (four plain line icons in a row, no button borders).
- **A collapsible bar** right under the title: a full-width rounded bar, slightly lighter than the pane, with a small
  icon at the left, a bold label, and a chevron at the far right.
- **A header block:** a large round avatar (about 56 px, an initial on a coloured disc), then a bold line (who), a
  second line starting with a small muted label and a value ("To: …" with a small green check before the value), and a
  muted timestamp right-aligned on the first line.
- **The body:** paragraphs with generous vertical spacing (about one blank line between blocks), a bold section heading
  with a small icon before it, and a list of **"Label: value" lines** where the label is bold and the value regular:
  five lines of that kind, one under the other, each starting with a bullet.
- Plenty of empty space below; the pane scrolls on its own.

### Right pane: the fixed rail
- **Header:** the month name at the top-left (about 18 px, regular weight), and two small icons at the top-right (a
  plus, and a panel toggle).
- **Month calendar:** a row of seven weekday initials (S M T W T F S) in the muted colour, then a grid of plain numbers
  with no cell borders, about 29 px per column. **Today is a filled circle in the accent colour** with the number in
  white. The **next month's first days are shown after the last week** in the same style, with a tiny month label
  ("Dec") above the 1. Six rows of weeks at most.
- Under the grid, centred, a small round button with a chevron pointing up (collapses the grid to one week).
- A hairline, then **a line naming the day** in the accent colour: "Today · Friday · 20 November", with a small round
  plus icon at the far right.
- **The agenda list** of that day, one item under the other, each about 80 px tall:
  - at the left, the time (11:00, 11:30, 12:00 …) with a muted duration under it (30m, 1h, 1h 10m);
  - then a **thin vertical bar** (about 4 px wide, the full height of the item) in a severity/category colour: solid,
    outlined (hollow) for a cancelled item, or diagonally hatched for a tentative one;
  - then a **bold title cut with an ellipsis**, and a **muted second line** (also cut with an ellipsis);
  - then a row of small round avatars (about 22 px) with a "+N" overflow at the end.
- The rail has a fixed width and scrolls on its own; the calendar stays at the top.

## 2. Workflow graph (the pipeline navigation)

A dark canvas with rounded cards laid out left to right and joined by thin lines.

- **Cards:** rounded rectangles (radius about 6 px) slightly lighter than the canvas, with a one-pixel border a little
  lighter than the fill. A single-row card is about 44 px tall; cards in the same row have the same height when they
  have the same number of rows. Widths in the screenshot: about 410–465 px each, with about 115 px between cards.
- **A row inside a card:** at the left, a **round status icon** about 22 px: a filled green circle with a white check
  (done) or a filled red circle with a white x (failed). Then the name in semibold, in the main text colour. At the far
  right of the row, a **muted value**, right-aligned (a duration such as 8s, 56s, 1m 50s, 2m 7s).
- **A card with several rows** stacks them with generous spacing (about 70 px between row centres), each row with its
  own status icon, name and right-aligned value; the card grows in height.
- **Connector dots:** each card has a small grey dot (about 12 px, a lighter ring around a darker centre) centred on
  its **left edge** and one on its **right edge**, at mid-height for a single-row card (for the taller card, level with
  its first row). The dot overlaps the card's border, half in and half out.
- **Lines:** a thin grey line (about 2 px) joins one card's right dot to the next card's left dot. A line may fork:
  from the first card's right dot one line runs straight to the next card of the row, and another turns down with a
  rounded corner to a card on a second row; that second-row card's right dot joins back, with a rounded corner going
  up, into the line that reaches the last card.
- There is no arrowhead; the left-to-right order alone gives the direction.

## What each reference stands for in the redesign
- Reference 1 is the three-pane layout of every screen: the list (Alunos, INVAs, Recursos, Pedidos…), the detail edited
  in place, and the right rail with the month calendar (the only date control) and that date's notifications.
- Reference 2 is the primary navigation: the four stages (Pedidos → Processamento → Escala → Aprovar) as cards in a row,
  each with its sub-tasks as rows with a status icon and a value.
