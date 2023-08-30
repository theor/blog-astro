import { pagesGlobToRssItems } from '@astrojs/rss';

export default function (
    /** @type {import('plop').NodePlopAPI} */
    plop) {
        plop.setHelper("now", () => new Date().toISOString());
    // controller generator
    plop.setGenerator('post', {
        description: 'new post',
        prompts: [{
            type: 'input',
            name: 'title',
            message: 'post title:'
        }],
        actions: [{
            type: 'add',
            path: 'src/content/blog/{{dashCase title}}/index.mdx',
            template: `---
title: "{{title}}"
author: "theor"
type: "post"
pubDate: {{now}}
description: ""
banner: ""
tags: []
---

# Title
            
`
        }]
    });
};