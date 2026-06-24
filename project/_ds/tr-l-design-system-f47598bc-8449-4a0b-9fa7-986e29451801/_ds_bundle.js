/* @ds-bundle: {"format":3,"namespace":"TrLDesignSystem_f47598","components":[{"name":"ChatBubble","sourcePath":"components/chat/ChatBubble.jsx"},{"name":"ChatActions","sourcePath":"components/chat/ChatBubble.jsx"},{"name":"Composer","sourcePath":"components/chat/Composer.jsx"},{"name":"DayDivider","sourcePath":"components/chat/DayDivider.jsx"},{"name":"TypingIndicator","sourcePath":"components/chat/TypingIndicator.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"ModelChip","sourcePath":"components/core/ModelChip.jsx"},{"name":"Toggle","sourcePath":"components/core/Toggle.jsx"},{"name":"AppBar","sourcePath":"components/layout/AppBar.jsx"},{"name":"Card","sourcePath":"components/layout/Card.jsx"},{"name":"IconTile","sourcePath":"components/layout/Card.jsx"},{"name":"IconButton","sourcePath":"components/layout/IconButton.jsx"},{"name":"ListRow","sourcePath":"components/layout/ListRow.jsx"}],"sourceHashes":{"components/chat/ChatBubble.jsx":"fb33666cce8c","components/chat/Composer.jsx":"0131de8ba36d","components/chat/DayDivider.jsx":"bb590e291a3e","components/chat/TypingIndicator.jsx":"ef0418d8208a","components/core/Badge.jsx":"9a1b709ce5cc","components/core/Button.jsx":"ab88b0292520","components/core/Chip.jsx":"21c37f43fefa","components/core/ModelChip.jsx":"d82aed33f173","components/core/Toggle.jsx":"77f3ff87d09e","components/layout/AppBar.jsx":"60df2b3c9714","components/layout/Card.jsx":"86dd0f3a3fc6","components/layout/IconButton.jsx":"dfe34d49ec0c","components/layout/ListRow.jsx":"831ddfcfa55b","ui_kits/app/screens.jsx":"425c4fd071d9"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TrLDesignSystem_f47598 = window.TrLDesignSystem_f47598 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/chat/ChatBubble.jsx
try { (() => {
/** Renders `inline code` spans on a jade-soft background, like the app. */
function renderInlineCode(text) {
  const parts = String(text).split("`");
  return parts.map((part, i) => i % 2 === 1 ? /*#__PURE__*/React.createElement("code", {
    key: i,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "0.9em",
      background: "var(--jade-soft)",
      color: "var(--jade-deep)",
      borderRadius: 4,
      padding: "1px 5px"
    }
  }, part) : /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, part));
}

/**
 * ChatBubble — the signature shape. User bubbles are jade with the tail
 * on the bottom-right; AI bubbles are white-outlined with the tail on the
 * top-left. Optional meta line (time · model) and AI action row.
 */
function ChatBubble({
  from = "ai",
  children,
  meta = null,
  failed = false,
  actions = null,
  style = {}
}) {
  const isUser = from === "user";
  const radius = isUser ? "var(--radius-bubble) var(--radius-bubble) var(--radius-xs) var(--radius-bubble)" : "var(--radius-xs) var(--radius-bubble) var(--radius-bubble) var(--radius-bubble)";
  let bg = "var(--bubble-ai-bg)";
  let color = "var(--bubble-ai-ink)";
  let border = "1px solid var(--border-default)";
  if (isUser) {
    bg = failed ? "var(--failed-bg)" : "var(--bubble-user-bg)";
    color = failed ? "var(--ink)" : "var(--bubble-user-ink)";
    border = failed ? "1px solid var(--failed-border)" : "1px solid transparent";
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 300,
      padding: "11px 14px",
      background: bg,
      color,
      border,
      borderRadius: radius,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-body)",
      lineHeight: 1.55,
      wordBreak: "break-word"
    }
  }, typeof children === "string" ? renderInlineCode(children) : children), meta != null && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 6px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-micro)",
      color: failed ? "var(--danger)" : "var(--text-secondary)"
    }
  }, meta), actions);
}

/** ChatActions — the 📋 Sao chép · 🔄 Tạo lại · 👍 👎 row under AI replies. */
function ChatActions({
  items = ["📋 Sao chép", "🔄 Tạo lại", "👍", "👎"],
  onAction
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      padding: "0 6px"
    }
  }, items.map(label => /*#__PURE__*/React.createElement("button", {
    key: label,
    onClick: () => onAction && onAction(label),
    style: {
      border: "none",
      background: "transparent",
      padding: 2,
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-medium)",
      fontSize: "var(--fs-caption)",
      color: "var(--text-secondary)",
      cursor: "pointer",
      WebkitTapHighlightColor: "transparent"
    }
  }, label)));
}
Object.assign(__ds_scope, { ChatBubble, ChatActions });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chat/ChatBubble.jsx", error: String((e && e.message) || e) }); }

// components/chat/Composer.jsx
try { (() => {
/** Material Symbols Rounded glyph (load the font in the host page). */
function Sym({
  name,
  size = 21,
  color = "var(--ink-2)"
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-rounded",
    style: {
      fontSize: size,
      color,
      lineHeight: 1,
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      userSelect: "none",
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"
    }
  }, name);
}

/**
 * Composer — the bottom input pill. Optional emoji & "deep think" toggles,
 * an attach button, and a circular send/mic FAB. Field border turns jade
 * on focus; the whole row dims when disabled (offline state).
 */
function Composer({
  value = "",
  onChange,
  placeholder = "Nhắn cho trợ lý…",
  enabled = true,
  showEmoji = false,
  deepThink = null,
  // null = hide; boolean = show toggle
  onDeepThink,
  sendIcon = "send",
  // "send" on chat, "mic" on welcome
  onSend,
  onFocus,
  style = {}
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      padding: "10px 12px 16px",
      opacity: enabled ? 1 : 0.6,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "flex-end",
      gap: 2,
      padding: showEmoji ? "5px 6px 5px 4px" : "5px 6px 5px 14px",
      background: "var(--surface-card)",
      border: `1.5px solid ${focused && enabled ? "var(--jade)" : "var(--line)"}`,
      borderRadius: "var(--radius-sheet)",
      transition: "border-color var(--dur-fast) var(--ease-standard)"
    }
  }, showEmoji && /*#__PURE__*/React.createElement("button", {
    onClick: () => {},
    disabled: !enabled,
    style: iconBtn
  }, /*#__PURE__*/React.createElement(Sym, {
    name: "mood",
    size: 22
  })), /*#__PURE__*/React.createElement("textarea", {
    rows: 1,
    value: value,
    disabled: !enabled,
    placeholder: placeholder,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => {
      setFocused(true);
      onFocus && onFocus();
    },
    onBlur: () => setFocused(false),
    style: {
      flex: 1,
      border: "none",
      outline: "none",
      resize: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-body-lg)",
      lineHeight: "21px",
      color: "var(--ink)",
      padding: "8px 4px",
      maxHeight: 110
    }
  }), deepThink !== null && /*#__PURE__*/React.createElement("button", {
    onClick: onDeepThink,
    disabled: !enabled,
    style: {
      ...iconBtn,
      background: deepThink ? "var(--jade-soft)" : "transparent"
    },
    title: "Suy ngh\u0129 s\xE2u"
  }, /*#__PURE__*/React.createElement(Sym, {
    name: "psychology",
    size: 21,
    color: deepThink ? "var(--jade)" : "var(--ink-2)"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => {},
    disabled: !enabled,
    style: iconBtn
  }, /*#__PURE__*/React.createElement(Sym, {
    name: "attach_file",
    size: 19
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: onSend,
    disabled: !enabled,
    style: {
      width: 46,
      height: 46,
      flex: "none",
      border: "none",
      borderRadius: "var(--radius-full)",
      background: enabled ? "var(--jade)" : "var(--line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: enabled ? "pointer" : "not-allowed",
      outline: "none",
      WebkitTapHighlightColor: "transparent"
    }
  }, /*#__PURE__*/React.createElement(Sym, {
    name: sendIcon,
    size: 21,
    color: enabled ? "#fff" : "var(--ink-2)"
  })));
}
const iconBtn = {
  width: 38,
  height: 38,
  flex: "none",
  border: "none",
  background: "transparent",
  borderRadius: "var(--radius-full)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  outline: "none",
  WebkitTapHighlightColor: "transparent"
};
Object.assign(__ds_scope, { Composer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chat/Composer.jsx", error: String((e && e.message) || e) }); }

// components/chat/DayDivider.jsx
try { (() => {
/**
 * DayDivider — a centered pill label between message groups
 * ("Hôm nay", "Hôm qua").
 */
function DayDivider({
  children = "Hôm nay",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "4px 12px",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-semibold)",
      fontSize: "var(--fs-eyebrow)",
      color: "var(--text-secondary)"
    }
  }, children));
}
Object.assign(__ds_scope, { DayDivider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chat/DayDivider.jsx", error: String((e && e.message) || e) }); }

// components/chat/TypingIndicator.jsx
try { (() => {
/**
 * TypingIndicator — three jade dots breathing in opacity inside an
 * AI-shaped bubble (top-left tail). Honors prefers-reduced-motion.
 */
function TypingIndicator({
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      gap: 5,
      alignItems: "center",
      padding: "14px 16px",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-xs) var(--radius-bubble) var(--radius-bubble) var(--radius-bubble)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, `
        @keyframes troly-typing { 0%,100% { opacity: .3 } 50% { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          .troly-typing-dot { animation: none !important; opacity: .7 !important; }
        }
      `), [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "troly-typing-dot",
    style: {
      width: 7,
      height: 7,
      borderRadius: "var(--radius-full)",
      background: "var(--jade)",
      animation: `troly-typing var(--dur-typing) ${i * 200}ms infinite ease-in-out`
    }
  })));
}
Object.assign(__ds_scope, { TypingIndicator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chat/TypingIndicator.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — tiny rounded label. `tone="cloud"` is jade-soft (cloud models),
 * `tone="local"` is the warm sand badge for home-server models.
 */
function Badge({
  tone = "cloud",
  children,
  style = {},
  ...rest
}) {
  const tones = {
    cloud: {
      background: "var(--jade-soft)",
      color: "var(--jade-deep)"
    },
    local: {
      background: "var(--warn-bg)",
      color: "var(--warn-ink-2)"
    },
    danger: {
      background: "var(--danger-soft)",
      color: "var(--danger)"
    },
    neutral: {
      background: "var(--bg)",
      color: "var(--text-secondary)"
    }
  }[tone];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-bold)",
      fontSize: "var(--fs-micro)",
      lineHeight: 1.4,
      ...tones,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — Trợ Lý's primary action control.
 * Jade fill for primary, hairline-outlined surface for secondary,
 * transparent for ghost. Pill-shaped by default (the app's button shape).
 */
function Button({
  variant = "primary",
  size = "md",
  pill = true,
  full = false,
  disabled = false,
  leading = null,
  children,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      padding: "7px 14px",
      fontSize: "var(--fs-small)",
      height: 32
    },
    md: {
      padding: "10px 18px",
      fontSize: "var(--fs-label)",
      height: 40
    },
    lg: {
      padding: "15px 22px",
      fontSize: "var(--fs-body)",
      height: 54
    }
  }[size];
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: full ? "100%" : "auto",
    height: sizes.height,
    padding: sizes.padding,
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--fw-bold)",
    fontSize: sizes.fontSize,
    lineHeight: 1,
    borderRadius: pill ? "var(--radius-pill)" : "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "1px solid transparent",
    transition: "background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)",
    WebkitTapHighlightColor: "transparent",
    whiteSpace: "nowrap"
  };
  const variants = {
    primary: {
      background: "var(--action-primary)",
      color: "var(--text-on-jade)"
    },
    secondary: {
      background: "var(--surface-card)",
      color: "var(--text-secondary)",
      borderColor: "var(--border-default)"
    },
    ghost: {
      background: "transparent",
      color: "var(--text-accent)"
    },
    danger: {
      background: "var(--danger)",
      color: "#fff"
    }
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      ...base,
      ...variants,
      ...style
    },
    onMouseDown: e => {
      if (disabled) return;
      if (variant === "primary") e.currentTarget.style.background = "var(--action-primary-press)";
      if (variant === "secondary" || variant === "ghost") e.currentTarget.style.background = "var(--surface-accent)";
    },
    onMouseUp: e => {
      e.currentTarget.style.background = variants.background;
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = variants.background;
    }
  }, rest), leading, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Chip — a horizontally-scrolling pill (suggestion prompts under the
 * composer). White surface, hairline border, jade-deep label.
 */
function Chip({
  active = false,
  children,
  onClick,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      flex: "none",
      padding: "9px 14px",
      background: active ? "var(--jade-soft)" : "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-medium)",
      fontSize: "var(--fs-chip)",
      color: "var(--jade-deep)",
      cursor: "pointer",
      whiteSpace: "nowrap",
      WebkitTapHighlightColor: "transparent",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/ModelChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ModelChip — the signature element centered in the app bar.
 * A pill showing a status dot, the active model name, and a server
 * label with a ▾ affordance. Tap to open the model picker.
 */
function ModelChip({
  name = "Qwen3 35B",
  sub = "Máy chủ nhà",
  dotColor = "var(--jade)",
  onClick,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      maxWidth: "100%",
      padding: "9px 14px",
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-pill)",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      WebkitTapHighlightColor: "transparent",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "var(--radius-full)",
      background: dotColor,
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: "var(--fw-bold)",
      fontSize: "var(--fs-body)",
      color: "var(--text-primary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--fs-eyebrow)",
      color: "var(--text-secondary)",
      whiteSpace: "nowrap",
      flex: "none"
    }
  }, sub, " \u25BE"));
}
Object.assign(__ds_scope, { ModelChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ModelChip.jsx", error: String((e && e.message) || e) }); }

// components/core/Toggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Toggle — the app's 46×26 switch. Jade track when on, hairline track
 * when off, white thumb with a soft drop shadow that slides ~180ms.
 */
function Toggle({
  checked = false,
  onChange,
  disabled = false,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      position: "relative",
      width: 46,
      height: 26,
      flex: "none",
      padding: 0,
      border: "none",
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--jade)" : "var(--line)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--dur-toggle) var(--ease-standard)",
      WebkitTapHighlightColor: "transparent",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: checked ? 23 : 3,
      width: 20,
      height: 20,
      borderRadius: "var(--radius-full)",
      background: "#fff",
      boxShadow: "var(--shadow-thumb)",
      transition: "left var(--dur-toggle) var(--ease-standard)"
    }
  }));
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toggle.jsx", error: String((e && e.message) || e) }); }

// components/layout/AppBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * AppBar — the fixed top bar: left slot · flexible center · right slot.
 * Center is usually a ModelChip, or a screen title (left-aligned with
 * `title` for History/Settings).
 */
function AppBar({
  left = null,
  center = null,
  right = null,
  title = null,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "var(--appbar-pad-y) var(--appbar-pad-x)",
      background: "var(--surface-app)",
      ...style
    }
  }, rest), left, title != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-extrabold)",
      fontSize: "var(--fs-title)",
      color: "var(--text-primary)"
    }
  }, title) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex"
    }
  }, center), right);
}
Object.assign(__ds_scope, { AppBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/AppBar.jsx", error: String((e && e.message) || e) }); }

// components/layout/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — a white, hairline-bordered, 16px-rounded surface. The base
 * container for hello-cards, error cards, and settings groups.
 */
function Card({
  children,
  padded = true,
  onClick,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding: padded ? "13px 16px" : 0,
      cursor: onClick ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
      ...style
    }
  }, rest), children);
}

/**
 * IconTile — the rounded jade-soft square that holds an emoji throughout
 * the app (model rows, history rows, settings rows, the logo).
 */
function IconTile({
  children,
  size = 40,
  radius = "var(--radius-tile)",
  bg = "var(--jade-soft)",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      flex: "none",
      borderRadius: radius,
      background: bg,
      fontSize: Math.round(size * 0.42),
      lineHeight: 1,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card, IconTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/Card.jsx", error: String((e && e.message) || e) }); }

// components/layout/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — a 42px circular tap target for app-bar glyphs
 * (☰ ⚙ ✚ ← 🔍). Renders its child (emoji/Unicode glyph/icon) centered.
 */
function IconButton({
  children,
  onClick,
  size = 42,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      flex: "none",
      padding: 0,
      border: "none",
      background: "transparent",
      borderRadius: "var(--radius-full)",
      fontFamily: "var(--font-sans)",
      fontSize: 18,
      lineHeight: 1,
      color: "var(--text-primary)",
      cursor: "pointer",
      WebkitTapHighlightColor: "transparent",
      transition: "background var(--dur-fast) var(--ease-standard)",
      ...style
    },
    onMouseDown: e => e.currentTarget.style.background = "var(--surface-accent)",
    onMouseUp: e => e.currentTarget.style.background = "transparent",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/layout/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ListRow — the emoji-tile + title/subtitle + trailing row used by
 * Settings, History, and the model picker. Trailing defaults to a ›
 * chevron; pass a Toggle or radio for controls.
 */
function ListRow({
  emoji,
  iconBg = "var(--jade-soft)",
  title,
  subtitle,
  titleColor = "var(--text-primary)",
  trailing,
  onClick,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      padding: "14px 16px",
      cursor: onClick ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
      ...style
    }
  }, rest), emoji != null && /*#__PURE__*/React.createElement(__ds_scope.IconTile, {
    size: 36,
    radius: "var(--radius-md)",
    bg: iconBg
  }, emoji), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--fw-semibold)",
      fontSize: "var(--fs-body)",
      color: titleColor,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, title), subtitle != null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-small)",
      color: "var(--text-secondary)",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      display: "flex",
      alignItems: "center"
    }
  }, trailing !== undefined ? trailing : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--fs-body)",
      color: "var(--text-secondary)"
    }
  }, "\u203A")));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/ListRow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/screens.jsx
try { (() => {
/* Trợ Lý — UI kit screens. Composes the design-system primitives from
   window.TrLDesignSystem_f47598. Each screen is a pure presentational
   component driven by the `app` state object passed from index.html.
   Exports all screens + the model sheet to window. */

const DS = window.TrLDesignSystem_f47598;
const {
  AppBar,
  IconButton,
  ModelChip,
  Card,
  IconTile,
  ListRow,
  Button,
  Toggle,
  Badge,
  Chip,
  ChatBubble,
  ChatActions,
  TypingIndicator,
  DayDivider,
  Composer
} = DS;
const MODELS = [{
  name: "Qwen3 35B",
  desc: "Nhanh, riêng tư, chạy trên server Ollama",
  local: true,
  emoji: "🏠",
  server: "Máy chủ nhà"
}, {
  name: "Qwen3 8B",
  desc: "Siêu nhanh cho câu hỏi ngắn",
  local: true,
  emoji: "🏠",
  server: "Máy chủ nhà"
}, {
  name: "Claude Sonnet",
  desc: "Suy luận sâu, viết lách tốt nhất",
  local: false,
  emoji: "☁️",
  server: "Đám mây"
}, {
  name: "DeepSeek V3",
  desc: "Rẻ, mạnh về code và toán",
  local: false,
  emoji: "☁️",
  server: "Đám mây"
}];
const SUGGESTIONS = ["So sánh với Hive Metastore", "Cho ví dụ phân quyền", "Vẽ sơ đồ kiến trúc"];
const HISTORY = [{
  emoji: "📌",
  title: "Pipeline MLOps Databricks",
  snippet: "Batch prediction cho model chấm điểm…",
  time: "T2",
  pinned: true,
  section: "Đã ghim"
}, {
  emoji: "💬",
  title: "Unity Catalog là gì",
  snippet: "Unity Catalog là lớp quản trị tập trung…",
  time: "9:38",
  section: "Hôm nay"
}, {
  emoji: "🎬",
  title: "Kịch bản tập 47 — đoản kịch",
  snippet: "Cliffhanger: Lan phát hiện bức thư trong…",
  time: "8:12",
  section: "Hôm nay"
}, {
  emoji: "🔧",
  title: "Lỗi ComfyUI hết VRAM",
  snippet: "Thử bật --lowvram hoặc tách bước decode…",
  time: "21:04",
  section: "Hôm qua"
}, {
  emoji: "📈",
  title: "So sánh chi phí API LLM",
  snippet: "Bảng giá DeepSeek vs Qwen theo 1M token…",
  time: "15:40",
  section: "Hôm qua"
}];
const screenBox = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--bg)"
};
const scrollArea = {
  flex: 1,
  overflowY: "auto",
  minHeight: 0
};

// ============================================================ WELCOME
function WelcomeScreen({
  app
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: screenBox
  }, /*#__PURE__*/React.createElement(AppBar, {
    left: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("history")
    }, "\u2630"),
    center: /*#__PURE__*/React.createElement(ModelChip, {
      name: app.model.name,
      sub: app.model.server,
      onClick: app.openSheet
    }),
    right: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("settings")
    }, "\u2699")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...scrollArea,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "0 28px"
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    size: 56,
    radius: "var(--radius-xl)",
    bg: "var(--jade)",
    style: {
      color: "#fff"
    }
  }, "\uD83C\uDF3F"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-extrabold)",
      fontSize: "var(--fs-hero)",
      lineHeight: "31px",
      color: "var(--ink)",
      marginTop: 18
    }
  }, app.greeting, " anh mu\u1ED1n ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--jade)"
    }
  }, "h\u1ECFi g\xEC"), " h\xF4m nay?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--fs-body)",
      color: "var(--ink-2)",
      marginTop: 8
    }
  }, "Tr\u1EE3 l\xFD s\u1EB5n s\xE0ng \u2014 g\xF5 tin nh\u1EAFn, n\xF3i, ho\u1EB7c g\u1EEDi \u1EA3nh."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      marginTop: 18
    }
  }, [["📝 Viết giúp tôi", "Email, kịch bản, bài đăng mạng xã hội"], ["💻 Hỗ trợ lập trình", "Giải thích lỗi, viết hàm, review code"], ["📄 Tóm tắt tài liệu", "Gửi PDF / ảnh chụp để phân tích nhanh"]].map(([t, s]) => /*#__PURE__*/React.createElement(Card, {
    key: t,
    onClick: () => app.go("chat")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-bold)",
      fontSize: "var(--fs-body)",
      color: "var(--ink)"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--fs-small)",
      color: "var(--ink-2)",
      marginTop: 2
    }
  }, s))))), /*#__PURE__*/React.createElement(Composer, {
    value: "",
    sendIcon: "mic",
    onFocus: () => app.go("chat"),
    onSend: () => app.go("chat")
  }));
}

// ============================================================ CHAT
function ChatScreen({
  app
}) {
  const [draft, setDraft] = React.useState("");
  const [think, setThink] = React.useState(false);
  const endRef = React.useRef(null);
  React.useEffect(() => {
    endRef.current && endRef.current.scrollIntoView({
      block: "end"
    });
  }, [app.messages.length, app.typing]);
  const send = text => {
    const t = (text != null ? text : draft).trim();
    if (!t) return;
    setDraft("");
    app.sendMessage(t);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: screenBox
  }, /*#__PURE__*/React.createElement(AppBar, {
    left: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("history")
    }, "\u2630"),
    center: /*#__PURE__*/React.createElement(ModelChip, {
      name: app.model.name,
      sub: app.model.server,
      onClick: app.openSheet
    }),
    right: /*#__PURE__*/React.createElement(IconButton, {
      onClick: app.newChat
    }, "\u271A")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...scrollArea,
      padding: "8px 16px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(DayDivider, null, "H\xF4m nay"), app.messages.map(m => /*#__PURE__*/React.createElement(ChatBubble, {
    key: m.id,
    from: m.from,
    meta: m.from === "ai" ? `${m.time} · ${app.model.name}` : m.time,
    actions: m.from === "ai" ? /*#__PURE__*/React.createElement(ChatActions, {
      onAction: app.onAction
    }) : null
  }, m.text)), app.typing && /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(TypingIndicator, null)), /*#__PURE__*/React.createElement("div", {
    ref: endRef
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      padding: "6px 16px"
    }
  }, SUGGESTIONS.map(s => /*#__PURE__*/React.createElement(Chip, {
    key: s,
    onClick: () => send(s)
  }, s))), /*#__PURE__*/React.createElement(Composer, {
    value: draft,
    onChange: setDraft,
    showEmoji: true,
    deepThink: think,
    onDeepThink: () => setThink(!think),
    onSend: () => send()
  }));
}

// ============================================================ HISTORY
function HistoryScreen({
  app
}) {
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState(null);
  const filtered = app.history.filter(h => !query || h.title.toLowerCase().includes(query.toLowerCase()) || h.snippet.toLowerCase().includes(query.toLowerCase()));
  const sections = {};
  filtered.forEach(h => {
    (sections[h.section] = sections[h.section] || []).push(h);
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...screenBox,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    left: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("chat")
    }, "\u2190"),
    title: "H\u1ED9i tho\u1EA1i",
    right: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("settings")
    }, "\u2699")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "4px 16px 10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "11px 16px",
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-pill)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, "\uD83D\uDD0D"), /*#__PURE__*/React.createElement("input", {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: "T\xECm trong h\u1ED9i tho\u1EA1i\u2026",
    style: {
      flex: 1,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--fs-body)",
      color: "var(--ink)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: scrollArea
  }, Object.keys(sections).length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "60px 28px",
      color: "var(--ink-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 34
    }
  }, "\uD83D\uDDC2"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-bold)",
      fontSize: 14,
      color: "var(--ink)",
      marginTop: 10
    }
  }, "Kh\xF4ng t\xECm th\u1EA5y k\u1EBFt qu\u1EA3"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      marginTop: 2
    }
  }, "Th\u1EED t\u1EEB kh\xF3a kh\xE1c xem sao.")), Object.entries(sections).map(([sec, entries]) => /*#__PURE__*/React.createElement("div", {
    key: sec
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: "var(--fw-bold)",
      letterSpacing: "var(--ls-eyebrow)",
      textTransform: "uppercase",
      color: "var(--ink-2)",
      padding: "14px 20px 6px"
    }
  }, sec), entries.map(h => /*#__PURE__*/React.createElement(ListRow, {
    key: h.title,
    emoji: h.emoji,
    title: /*#__PURE__*/React.createElement("span", null, h.title, h.pinned && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--amber)",
        fontSize: 11
      }
    }, " \u2605")),
    subtitle: h.snippet,
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: "var(--ink-2)"
      }
    }, h.time),
    onClick: () => app.go("chat")
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 90
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      right: 18,
      bottom: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: app.newChat,
    style: {
      boxShadow: "var(--shadow-fab)"
    }
  }, "\u271A Chat m\u1EDBi")), pending && /*#__PURE__*/React.createElement(ConfirmDialog, {
    title: "X\xF3a h\u1ED9i tho\u1EA1i?",
    body: `"${pending.title}" sẽ bị xóa vĩnh viễn. Không thể hoàn tác.`,
    onCancel: () => setPending(null),
    onConfirm: () => {
      app.deleteHistory(pending);
      setPending(null);
    }
  }));
}

// ============================================================ SETTINGS
function SettingsScreen({
  app
}) {
  const [confirm, setConfirm] = React.useState(false);
  const divider = /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--line)"
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: screenBox
  }, /*#__PURE__*/React.createElement(AppBar, {
    left: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("chat")
    }, "\u2190"),
    title: "C\xE0i \u0111\u1EB7t"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...scrollArea,
      padding: "4px 16px 24px"
    }
  }, /*#__PURE__*/React.createElement(GroupTitle, null, "M\xF4 h\xECnh & m\xE1y ch\u1EE7"), /*#__PURE__*/React.createElement(Card, {
    padded: false,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83E\uDDE0",
    title: "M\xF4 h\xECnh m\u1EB7c \u0111\u1ECBnh",
    subtitle: `${app.model.name} — ${app.model.server}`,
    onClick: app.openSheet
  }), divider, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83D\uDDA7",
    title: "M\xE1y ch\u1EE7 9Router",
    subtitle: "http://localhost:20128/v1"
  }), divider, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83D\uDD11",
    title: "API key 9Router",
    subtitle: "Ch\u01B0a c\u1EA5u h\xECnh \u2014 ch\u1EA1m \u0111\u1EC3 th\xEAm"
  }), divider, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\u26A1",
    title: "Tr\u1EA3 l\u1EDDi d\u1EA1ng stream",
    subtitle: "Hi\u1EC7n ch\u1EEF ngay khi m\xF4 h\xECnh sinh ra",
    trailing: /*#__PURE__*/React.createElement(Toggle, {
      checked: app.stream,
      onChange: app.setStream
    })
  })), /*#__PURE__*/React.createElement(GroupTitle, null, "Giao di\u1EC7n"), /*#__PURE__*/React.createElement(Card, {
    padded: false,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83C\uDF19",
    title: "Ch\u1EBF \u0111\u1ED9 t\u1ED1i",
    subtitle: app.dark ? "Đang bật" : "Theo hệ thống",
    trailing: /*#__PURE__*/React.createElement(Toggle, {
      checked: app.dark,
      onChange: app.setDark
    })
  }), divider, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83D\uDD24",
    title: "C\u1EE1 ch\u1EEF",
    subtitle: "V\u1EEBa"
  }), divider, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83C\uDF99",
    title: "\u0110\u1ECDc to c\xE2u tr\u1EA3 l\u1EDDi",
    subtitle: "Gi\u1ECDng ti\u1EBFng Vi\u1EC7t \u2014 Nam mi\u1EC1n Nam",
    trailing: /*#__PURE__*/React.createElement(Toggle, {
      checked: app.readAloud,
      onChange: app.setReadAloud
    })
  })), /*#__PURE__*/React.createElement(GroupTitle, null, "D\u1EEF li\u1EC7u"), /*#__PURE__*/React.createElement(Card, {
    padded: false,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83D\uDCBE",
    title: "Sao l\u01B0u h\u1ED9i tho\u1EA1i",
    subtitle: "Xu\u1EA5t file JSON v\u1EC1 b\u1ED9 nh\u1EDB m\xE1y"
  }), divider, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83D\uDDD1",
    title: "X\xF3a to\xE0n b\u1ED9 h\u1ED9i tho\u1EA1i",
    subtitle: "Kh\xF4ng th\u1EC3 ho\xE0n t\xE1c",
    titleColor: "var(--danger)",
    iconBg: "var(--danger-soft)",
    onClick: () => setConfirm(true)
  })), /*#__PURE__*/React.createElement(GroupTitle, null, "Kh\xE1c"), /*#__PURE__*/React.createElement(Card, {
    padded: false
  }, /*#__PURE__*/React.createElement(ListRow, {
    emoji: "\uD83D\uDD0C",
    title: "Xem demo l\u1ED7i k\u1EBFt n\u1ED1i",
    subtitle: "Tr\u1EA1ng th\xE1i m\u1EA5t k\u1EBFt n\u1ED1i m\xE1y ch\u1EE7",
    onClick: () => app.go("error")
  }))), confirm && /*#__PURE__*/React.createElement(ConfirmDialog, {
    title: "X\xF3a to\xE0n b\u1ED9 h\u1ED9i tho\u1EA1i?",
    body: "H\xE0nh \u0111\u1ED9ng n\xE0y kh\xF4ng th\u1EC3 ho\xE0n t\xE1c.",
    onCancel: () => setConfirm(false),
    onConfirm: () => {
      app.clearAll();
      setConfirm(false);
    }
  }));
}

// ============================================================ ERROR
function ErrorScreen({
  app
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: screenBox
  }, /*#__PURE__*/React.createElement(AppBar, {
    left: /*#__PURE__*/React.createElement(IconButton, {
      onClick: () => app.go("history")
    }, "\u2630"),
    center: /*#__PURE__*/React.createElement(ModelChip, {
      name: app.model.name,
      sub: "M\u1EA5t k\u1EBFt n\u1ED1i",
      dotColor: "var(--danger)",
      onClick: app.openSheet
    }),
    right: /*#__PURE__*/React.createElement(IconButton, null, "\u271A")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      background: "var(--warn-bg)",
      border: "1px solid var(--warn-border)",
      borderRadius: "var(--radius-lg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17
    }
  }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-bold)",
      fontSize: 13,
      color: "var(--warn-ink)"
    }
  }, "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c m\xE1y ch\u1EE7 nh\xE0"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--warn-ink-2)"
    }
  }, "\u0110\xE3 th\u1EED l\u1EA1i 2 l\u1EA7n \xB7 l\u1EA7n cu\u1ED1i 9:42")), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => app.go("chat")
  }, "Th\u1EED l\u1EA1i"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...scrollArea,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(DayDivider, null, "H\xF4m nay"), /*#__PURE__*/React.createElement(ChatBubble, {
    from: "ai",
    meta: "9:38 \xB7 Qwen3 35B"
  }, "Unity Catalog l\xE0 l\u1EDBp qu\u1EA3n tr\u1ECB t\u1EADp trung cho to\xE0n b\u1ED9 d\u1EEF li\u1EC7u v\xE0 AI tr\xEAn Databricks\u2026"), /*#__PURE__*/React.createElement(ChatBubble, {
    from: "user",
    failed: true,
    meta: "\u26A0 G\u1EEDi kh\xF4ng th\xE0nh c\xF4ng",
    actions: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        padding: "0 6px",
        justifyContent: "flex-end"
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "sm",
      onClick: () => app.go("chat")
    }, "\u21BB G\u1EEDi l\u1EA1i"), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      onClick: app.openSheet
    }, "\u0110\u1ED5i sang model \u0111\xE1m m\xE2y"))
  }, "So s\xE1nh gi\xFAp anh v\u1EDBi Hive Metastore"), /*#__PURE__*/React.createElement(Card, {
    style: {
      alignSelf: "center",
      maxWidth: 320,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28
    }
  }, "\uD83D\uDD0C"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-bold)",
      fontSize: 14,
      color: "var(--ink)",
      marginTop: 6
    }
  }, "M\u1EA5t k\u1EBFt n\u1ED1i t\u1EDBi m\xE1y ch\u1EE7"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-2)",
      lineHeight: 1.5,
      marginTop: 3
    }
  }, "Kh\xF4ng g\u1ECDi \u0111\u01B0\u1EE3c m\xE1y ch\u1EE7. Ki\u1EC3m tra server Ollama c\xF2n ch\u1EA1y v\xE0 \u0111i\u1EC7n tho\u1EA1i c\xF9ng m\u1EA1ng Wi-Fi."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "center",
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    onClick: () => app.go("chat")
  }, "\u21BB Th\u1EED k\u1EBFt n\u1ED1i l\u1EA1i"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    onClick: app.openSheet
  }, "\u0110\u1ED5i model")))), /*#__PURE__*/React.createElement(Composer, {
    enabled: false,
    placeholder: "M\u1EA5t k\u1EBFt n\u1ED1i \u2014 tin nh\u1EAFn s\u1EBD ch\u1EDD g\u1EEDi\u2026"
  }));
}

// ============================================================ MODEL SHEET
function ModelSheet({
  app
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: app.closeSheet,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(22,32,28,.32)",
      display: "flex",
      alignItems: "flex-end",
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      background: "var(--surface)",
      borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
      padding: "0 18px 26px",
      boxShadow: "var(--shadow-sheet)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 4,
      borderRadius: 99,
      background: "var(--line)",
      margin: "12px auto 14px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-extrabold)",
      fontSize: 16,
      color: "var(--ink)"
    }
  }, "Ch\u1ECDn m\xF4 h\xECnh"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink-2)",
      margin: "4px 0 14px"
    }
  }, "Chuy\u1EC3n m\xF4 h\xECnh gi\u1EEFa ch\u1EEBng \u2014 l\u1ECBch s\u1EED chat \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn."), MODELS.map(m => {
    const sel = m.name === app.model.name;
    return /*#__PURE__*/React.createElement("div", {
      key: m.name,
      onClick: () => app.selectModel(m),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 10px",
        borderRadius: "var(--radius-lg)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(IconTile, null, m.emoji), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: "var(--fw-bold)",
        fontSize: 14,
        color: "var(--ink)"
      }
    }, m.name), /*#__PURE__*/React.createElement(Badge, {
      tone: m.local ? "local" : "cloud"
    }, m.local ? "Máy nhà" : "Đám mây")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--ink-2)"
      }
    }, m.desc)), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 20,
        height: 20,
        borderRadius: 99,
        border: `${sel ? 6 : 2}px solid ${sel ? "var(--jade)" : "var(--line)"}`,
        boxSizing: "border-box"
      }
    }));
  })));
}

// ============================================================ shared bits
function GroupTitle({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: "var(--fw-bold)",
      letterSpacing: "var(--ls-eyebrow)",
      textTransform: "uppercase",
      color: "var(--ink-2)",
      padding: "8px 6px"
    }
  }, children);
}
function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onCancel,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(22,32,28,.32)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      background: "var(--surface)",
      borderRadius: "var(--radius-lg)",
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: "var(--fw-bold)",
      fontSize: 16,
      color: "var(--ink)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink-2)",
      marginTop: 8,
      lineHeight: 1.5
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: onCancel,
    style: {
      color: "var(--ink-2)"
    }
  }, "H\u1EE7y"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: onConfirm,
    style: {
      color: "var(--danger)"
    }
  }, "X\xF3a"))));
}
Object.assign(window, {
  WelcomeScreen,
  ChatScreen,
  HistoryScreen,
  SettingsScreen,
  ErrorScreen,
  ModelSheet,
  KIT_MODELS: MODELS,
  KIT_HISTORY: HISTORY
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.ChatBubble = __ds_scope.ChatBubble;

__ds_ns.ChatActions = __ds_scope.ChatActions;

__ds_ns.Composer = __ds_scope.Composer;

__ds_ns.DayDivider = __ds_scope.DayDivider;

__ds_ns.TypingIndicator = __ds_scope.TypingIndicator;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.ModelChip = __ds_scope.ModelChip;

__ds_ns.Toggle = __ds_scope.Toggle;

__ds_ns.AppBar = __ds_scope.AppBar;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconTile = __ds_scope.IconTile;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ListRow = __ds_scope.ListRow;

})();
