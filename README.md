# Storage is a form of forgiveness

A web stone-carving simulator: photographed stones, carved with a point chisel, flat chisel, bush hammer and polisher, with text inscriptions.

Plain HTML, CSS and JavaScript — no build step.

## Publish on GitHub Pages
1. Upload `index.html`, `style.css` and `script.js` to the root of a public repository.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
3. The site will be at `https://YOUR-USER.github.io/REPO-NAME/`.

## Add your own stones
Put a cut-out PNG (transparent background) in `stones/` and add a line to the `STONES` list at the top of `script.js`, e.g.
`{id:'my-stone',name:'My stone',note:'',src:'stones/my-stone.png',cut:[200,200,200],dust:''}`
(`cut` is the colour of freshly carved stone, in RGB).
