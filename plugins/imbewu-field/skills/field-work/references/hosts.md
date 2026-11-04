# Host differences

The remote endpoint is https://imbewufield.vercel.app/api/assistant/mcp and uses
Streamable HTTP with OAuth authorization code + S256 PKCE and dynamic public
client registration. No API key, shared token or customer password is packaged.

ChatGPT/Codex plugin installation and OAuth linking are separate steps. Use the
native connection action exposed by the installed plugin. The server advertises
resource metadata, per-tool OAuth requirements, HTTP challenges and tool-level
`mcp/www_authenticate` errors. Do not send users repeatedly to a settings gear
unless the actual current host shows an applicable connection action there.

For a host with direct MCP configuration, use its documented remote HTTP and
OAuth flow. Claude Code's documented registration is:

    claude mcp add --transport http imbewu-field https://imbewufield.vercel.app/api/assistant/mcp

Then authenticate through Claude Code's supported MCP account flow. This package
does not claim that Claude Desktop, Claude Code, ChatGPT and Codex share identical
file pickers, app views, account-linking controls or extension support.

The remote server cannot read a desktop file path. A local assistant with explicit
file permission can transfer the selected original using the bundled helper.
A cloud assistant can transfer a supported source download through its own
execution/file tools, if those tools are available and authorised. If the host
provides neither bytes nor a transfer mechanism, report that limitation instead
of importing a text reference and calling it the original attachment.

Official references:
- https://developers.openai.com/plugins/build/auth
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://code.claude.com/docs/en/mcp

Verification status is recorded in the repository audit, not inferred from these
configuration examples.
