# Stack Testing Field Guide

An interactive website that teaches stationary source emissions testing (stack testing) using the U.S. EPA reference methods. Each lesson pairs a short explanation with models you can adjust: traverse-point layouts, pitot tubes and manometers, sampling trains, isokinetic sampling, analyzer calibrations, and the full set of calculations that turn field data into pounds per hour.

## Lessons

| Page | Topic |
| --- | --- |
| `overview.html` | The test, start to finish: planning, test day, recovery, reporting |
| `method-1.html` | Method 1: sampling site, number and location of traverse points, cyclonic flow |
| `method-2.html` | Method 2: Type S pitot tube, velocity and volumetric flow rate |
| `method-3.html` | Methods 3, 3A, 3B: O₂, CO₂ and dry molecular weight |
| `method-4.html` | Method 4: moisture content |
| `method-5.html` | Method 5: particulate matter and isokinetic sampling |
| `instrumental.html` | Methods 3A, 6C, 7E, 10, 25A: analyzer QA, stratification, RATA |
| `more-methods.html` | Method finder for other pollutants (202, 26A, 29, 23, 9 and more) |
| `calculator.html` | Worked three-run Method 5 calculation |
| `movie.html` | Animated summary of the whole course, with chapters, captions and a transcript |
| `glossary.html` | Terms and symbols |

## Running it locally

The site is plain HTML, CSS and JavaScript with no build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly from disk also works.

## Publishing on GitHub Pages

1. Create an empty repository on GitHub (for example `stack-testing-guide`).
2. Push this folder to it:
   ```bash
   git add .
   git commit -m "Stack Testing Field Guide"
   git branch -M main
   git remote add origin https://github.com/<your-user>/stack-testing-guide.git
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-user>.github.io/stack-testing-guide/`.

The empty `.nojekyll` file tells GitHub Pages to serve the files as they are.

## Project layout

```
index.html            Home page
*.html                One page per lesson
assets/css/site.css   Shared design system (colors, type, layout, components)
assets/js/site.js     Navigation, course map, progress tracking, quizzes, helpers
assets/js/<page>.js   Interactive figures for each page
assets/img/           Favicon
```

Every page loads `site.js`, which builds the header, course map, lesson pager and quizzes from the `ST.course` list. To add a lesson, add it to that list and copy the structure of an existing lesson page.

External resources load from CDNs: fonts from Google Fonts and equation rendering from KaTeX on jsDelivr.

## Accuracy

The method summaries paraphrase the EPA reference methods for teaching. They are not a substitute for the current regulatory text at [eCFR](https://www.ecfr.gov/), the EPA [Emission Measurement Center](https://www.epa.gov/emc), or an approved test protocol.
