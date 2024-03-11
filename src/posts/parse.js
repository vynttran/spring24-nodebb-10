'use strict';

const nconf = require('nconf');
const url = require('url');
const winston = require('winston');
const sanitize = require('sanitize-html');
const _ = require('lodash');
const katex = require('katex'); // Added for latex rendering in posts
const Filter = require('bad-words');
const meta = require('../meta');
const plugins = require('../plugins');
const translator = require('../translator');
const utils = require('../utils');


let sanitizeConfig = {
    allowedTags: sanitize.defaults.allowedTags.concat([
        // Some safe-to-use tags to add
        'sup', 'ins', 'del', 'img', 'button',
        'video', 'audio', 'iframe', 'embed',
        // 'sup' still necessary until https://github.com/apostrophecms/sanitize-html/pull/422 merged
    ]),
    allowedAttributes: {
        ...sanitize.defaults.allowedAttributes,
        a: ['href', 'name', 'hreflang', 'media', 'rel', 'target', 'type'],
        img: ['alt', 'height', 'ismap', 'src', 'usemap', 'width', 'srcset'],
        iframe: ['height', 'name', 'src', 'width'],
        video: ['autoplay', 'controls', 'height', 'loop', 'muted', 'poster', 'preload', 'src', 'width'],
        audio: ['autoplay', 'controls', 'loop', 'muted', 'preload', 'src'],
        embed: ['height', 'src', 'type', 'width'],
    },
    globalAttributes: ['accesskey', 'class', 'contenteditable', 'dir',
        'draggable', 'dropzone', 'hidden', 'id', 'lang', 'spellcheck', 'style',
        'tabindex', 'title', 'translate', 'aria-expanded', 'data-*',
    ],
    allowedClasses: {
        ...sanitize.defaults.allowedClasses,
    },
};

module.exports = function (Posts) {
    Posts.urlRegex = {
        regex: /href="([^"]+)"/g,
        length: 6,
    };

    Posts.imgRegex = {
        regex: /src="([^"]+)"/g,
        length: 5,
    };

    /*
       * Parses a post object, sanitizing its content, replacing relative links with absolute URLs
       * and rendering LaTeX code into MathML using KaTeX.
       * @param {object} postData - the post object
       * @return {object} postData - the sanitized/rendered post object
    */
    /*
    Type definition for the postData object:
       type PostObject = {
           pid: number;
           tid: number;
           content: string;
           uid: number;
           timestamp: number;
           deleted: boolean;
           upvotes: number;
           downvotes: number;
           votes: number;
           timestampISO: string;
           user: UserObjectSlim;
           topic: TopicObject;
           category: CategoryObject;
           isMainPost: boolean;
           replies: number;
       };
    */

    /*
        * Renders LaTeX code into MathML using KaTeX
        * @param {object} postData - the post object, same type definition as input to Post.parsePost
        * @return {object} postData - the post object with LaTeX code rendered into MathML
        * @throws {Error} - if the rendering fails
    */
    const render_latex = async function (postData) {
        if (!postData) {
            return postData;
        }

        // assert types of input, documentation for JS
        if (typeof postData !== 'object' || typeof postData.content !== 'string') {
            throw new Error('[[error:invalid-data]]');
        }

        const block = /\$\$([\s\S]*?)\$\$/g; // regex to match $$...$$
        const inline = /\$([\s\S]*?)\$/g; // regex to match $...$

        // eslint-disable-next-line no-unused-vars
        const replaceBlock = function (match, p1, offset, string) {
            // chose to only render using mathml, sacrificing compatibility
            // with older browsers for better performance
            return katex.renderToString(p1, { displayMode: true, output: 'mathml' });
        };
        // eslint-disable-next-line no-unused-vars
        const replaceInline = function (match, p1, offset, string) {
            return katex.renderToString(p1, { displayMode: false, output: 'mathml' });
        };

        try {
            postData.content = postData.content.replace(block, replaceBlock).replace(inline, replaceInline);
        } catch (a) {
            winston.verbose(a.message);
        }

        console.assert(typeof postData === 'object', 'postData is not an object');
        console.assert(typeof postData.content === 'string', 'postData.content is not a string');

        return postData;
    };

    Posts.renderLatex = render_latex;

    Posts.parsePost = async function (postData) {
        if (!postData) {
            return postData;
        }

        // Assert the type of input is correct, and that the content is a string
        console.assert(typeof postData === 'object', 'postData.pid is not an object');
        console.assert(typeof postData.content === 'string', 'postData.content is not a string');

        postData.content = String(postData.content || '');
        const cache = require('./cache');
        const pid = String(postData.pid);
        const cachedContent = cache.get(pid);
        if (postData.pid && cachedContent !== undefined) {
            postData.content = cachedContent;
            return postData;
        }

        const data = await plugins.hooks.fire('filter:parse.post', { postData: postData });

        render_latex(data.postData); // render latex just before we translate the content

        data.postData.content = translator.escape(data.postData.content);
        if (data.postData.pid) {
            cache.set(pid, data.postData.content);
        }

        // Only asserting type of postData.content because that's the only thing we're changing
        // in this sprint.
        console.assert(typeof data.postData === 'object', 'postData.content is not an object');
        console.assert(data.postData.content, 'postData.content is not a string');
        return data.postData;
    };



    Posts.parseSignature = async function (userData, uid) {
        userData.signature = sanitizeSignature(userData.signature || '');
        return await plugins.hooks.fire('filter:parse.signature', { userData: userData, uid: uid });
    };

    Posts.relativeToAbsolute = function (content, regex) {
        // Turns relative links in content to absolute urls
        if (!content) {
            return content;
        }
        let parsed;
        let current = regex.regex.exec(content);
        let absolute;
        while (current !== null) {
            if (current[1]) {
                try {
                    parsed = url.parse(current[1]);
                    if (!parsed.protocol) {
                        if (current[1].startsWith('/')) {
                            // Internal link
                            absolute = nconf.get('base_url') + current[1];
                        } else {
                            // External link
                            absolute = `//${current[1]}`;
                        }

                        content = content.slice(0, current.index + regex.length) +
                        absolute +
                        content.slice(current.index + regex.length + current[1].length);
                    }
                } catch (err) {
                    winston.verbose(err.messsage);
                }
            }
            current = regex.regex.exec(content);
        }

        return content;
    };
    const filterProfanity = function (content) {
        // string -> string
        content = content || '_';
        const filter = new Filter();
        let cleaned = filter.clean(content);
        console.assert(typeof cleaned === 'string');
        if (cleaned === '_') {
            cleaned = '';
        }
        return cleaned;
    };
    Posts.filterProfanity = filterProfanity;

    Posts.sanitize = function (content) {
        return sanitize(filterProfanity(content), {
            allowedTags: sanitizeConfig.allowedTags,
            allowedAttributes: sanitizeConfig.allowedAttributes,
            allowedClasses: sanitizeConfig.allowedClasses,
        });
    };

    Posts.configureSanitize = async () => {
        // Each allowed tags should have some common global attributes...
        sanitizeConfig.allowedTags.forEach((tag) => {
            sanitizeConfig.allowedAttributes[tag] = _.union(
                sanitizeConfig.allowedAttributes[tag],
                sanitizeConfig.globalAttributes
            );
        });

        // Some plugins might need to adjust or whitelist their own tags...
        sanitizeConfig = await plugins.hooks.fire('filter:sanitize.config', sanitizeConfig);
    };

    Posts.registerHooks = () => {
        plugins.hooks.register('core', {
            hook: 'filter:parse.post',
            method: async (data) => {
                data.postData.content = Posts.sanitize(data.postData.content);
                return data;
            },
        });

        plugins.hooks.register('core', {
            hook: 'filter:parse.raw',
            method: async content => Posts.sanitize(content),
        });

        plugins.hooks.register('core', {
            hook: 'filter:parse.aboutme',
            method: async content => Posts.sanitize(content),
        });

        plugins.hooks.register('core', {
            hook: 'filter:parse.signature',
            method: async (data) => {
                data.userData.signature = Posts.sanitize(data.userData.signature);
                return data;
            },
        });
    };

    function sanitizeSignature(signature) {
        signature = translator.escape(signature);
        const tagsToStrip = [];

        if (meta.config['signatures:disableLinks']) {
            tagsToStrip.push('a');
        }

        if (meta.config['signatures:disableImages']) {
            tagsToStrip.push('img');
        }

        return utils.stripHTMLTags(signature, tagsToStrip);
    }
};
