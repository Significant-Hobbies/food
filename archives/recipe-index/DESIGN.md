# Design

## Direction

Recipe Index is a crisp Swiss food-lab ledger: the precision of a nutrition
label combined with the speed of a sortable research table. It rejects dark
admin chrome, lifestyle food photography, and generic SaaS cards. The interface
feels like a bright instrument built specifically to compare recipes.

## Physical scene

The product is used on a laptop or phone in an ordinary Indian kitchen or
workspace. A cool, light canvas keeps long comparison sessions legible;
high-chroma accents mark actions and selected evidence without turning the page
into a wellness brand.

## Color system

- Canvas: `#eef3ff`
- Paper: `#ffffff`
- Cobalt ink: `#102a72`
- Body ink: `#17213f`
- Muted ink: `#61709c`
- Hairline: `#b7c5ed`
- Acid-lime action: `#d7ff4f`
- Lime hover: `#c7ef35`
- Easy: `#126b45`
- Adaptable: `#9b5c00`
- Specialty: `#7c4764`

Practicality never depends on color alone.

## Typography

Use a dependency-free workhorse sans stack. Display text is condensed through
weight and width, not a decorative font. Data uses tabular numerals. Labels are
compact but never below 11 px on small screens.

## Layout

- No sidebar. The first viewport begins with product identity, the 10+10
  admission rule, the 45-food/5-drink composition, then controls and rows.
- Product identity stays generic. Every row carries its publisher credit and a
  direct source action.
- Desktop uses one bordered ledger with fixed comparison roles: recipe,
  protein, calories, protein density, India fit, and source action.
- Each row expands in place into key ingredients, serving-level macro evidence,
  source notes, India-fit guidance, and publisher credit.
- Phones replace the table grid with a compact record hierarchy while keeping
  source and disclosure actions immediately available.

## Components

- Collection strip: qualified total, food/drink composition, source breadth,
  and easy-in-India count.
- Control rail: search, dataset-backed multi-exclusions, protein source, format,
  India fit, diet, sort, and reset.
- Recipe row: publisher, format, serving macros, practicality, direct source,
  and details.
- Evidence sheet: key ingredients, serving basis, source macro caveat, India-fit
  note, and original publisher link.

## Interaction

Filtering and sorting are immediate. Ingredient and protein-source dropdowns
offer dataset-backed options with recipe counts; selected exclusions stay
visible as removable controls. The first protein strategy is visible on every
row, while the details panel lists all assigned strategies. Desktop headings
toggle sort direction while the synchronized select remains available on every
viewport. “Curated · food first” is the initial sort and places all five drinks
after the 45 foods; metric sorts intentionally mix formats. Empty and
unavailable states name both the problem and recovery.
