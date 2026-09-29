# Pinch

A pocket notebook for cooks: recipes, food costing, allergens and a service log.
Installable web app (PWA), works offline, data stays on your phone.

**Live:** https://jblee3030.github.io/pinch/ — open on your phone, then *Share → Add to Home Screen*.

## Features
- **Recipes** — ingredients, method, photo, scale to any number of portions
- **Sub-recipes** — use a sauce or dough inside a dish, by portion or by weight/volume; cost and allergens roll up
- **Costing** — cost per portion, suggested menu price (inc GST) from a target food cost %, actual food cost %
- **Pantry** — ingredient prices per kg / L / each with trim yield %; type new ingredients straight into a recipe and price them later
- **Allergens** — Australian mandatory allergens per ingredient, rolled up per recipe and as a chart
- **Service log** — school service periods and work shifts with station, hours, dishes and chef feedback
- **Order list** — pick recipes and portions; sub-recipes expand to raw ingredients, grossed up for trim yield, with estimated cost; share or print
- **Recipe card** — costed standard recipe card, scalable, print or save as A4 PDF
- **Backup** — export / import a JSON file

## Develop
No build step. Serve the folder and open it:

```
python3 -m http.server 8000
node calc.test.js
```
