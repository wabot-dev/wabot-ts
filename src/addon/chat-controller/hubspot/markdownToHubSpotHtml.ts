// HubSpot Conversations accepts a `richText` field with the same HTML subset
// that the shared chat converter produces (<b>, <i>, <s>, <code>, <pre>, <a>,
// <blockquote>). Re-exported under a HubSpot-specific name so call sites keep
// their channel intent explicit.
export { markdownToChatHtml as markdownToHubSpotHtml } from '../markdown/markdownToChatHtml'
