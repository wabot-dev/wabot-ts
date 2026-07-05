// Telegram's HTML subset (parse_mode: 'HTML') accepts the standard tags
// produced by the shared converter: <b>, <i>, <s>, <code>, <pre>, <a>, <blockquote>.
// Kept as a named re-export so existing imports and the channel's intent remain clear.
export { markdownToChatHtml as markdownToTelegramHtml } from '../markdown/markdownToChatHtml'
