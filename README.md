# theor.xyz

This is the source code of my blog, made with Astro 3.0 and @astrojs/mdx.

## 🚀 Project Structure

```
├── public/
├── src/
│   ├── components/
│   ├── content/
|   |   └─ article
|   |      ├─ index.mdx
|   |      └─ image.png
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── README.md
├── package.json
└── tsconfig.json
```

Articles are self-contained in their own folder in content. They support:
- auto import of components thanks to [https://astro-m2dx.netlify.app/](https://astro-m2dx.netlify.app/) : `Box`, `Figure` and `Video` components
- a `banner` in the frontmatter (and a `staticBanner` fallback for twitter cards if the banner is a video)
- a `draft` field

The site itself has RSS, a sitemap, basic tag support.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `yarn install`          | Installs dependencies                            |
| `yarn dev`              | Starts local dev server at `localhost:3000`      |
| `yarn build`            | Build your production site to `./dist/`          |
| `yarn preview`          | Preview your build locally, before deploying     |
| `yarn run astro ...`    | Run CLI commands like `astro add`, `astro check` |
| `yarn run astro --help` | Get help using the Astro CLI                     |
| `yarn plop`             | Create a new post                                |


## Credit

This theme is a highly customized [Bear Blog](https://github.com/HermanMartinus/bearblog/).
