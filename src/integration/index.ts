import type { AstroIntegration } from 'astro';
import { autoAbstract } from './remark/autoAbstract';
const PKG_NAME = '@theor/mySite';

export function myAstro(): AstroIntegration {
    return {
        name: PKG_NAME,
        hooks: {
            'astro:config:setup': async ({ command, config, updateConfig }) => {
                const isDev = command === 'dev';
                const remarkPlugins = [
                    () => autoAbstract(isDev),
                ];
                updateConfig({
                    markdown: { remarkPlugins },//, rehypePlugins },
                });
            },
            'astro:config:done': (options) => {
                console.log(options.config.markdown.remarkPlugins)
            },
        },
    };
}
