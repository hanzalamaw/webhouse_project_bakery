import { useT } from "../context/LanguageContext";

export function Button({
  children,
  type = "button",
  variant = "primary",
  className = "",
  ...rest
}) {
  const t = useT();
  const content = typeof children === "string" ? t(children) : children;
  return (
    <button type={type} className={`wh-btn wh-btn--${variant} ${className}`.trim()} {...rest}>
      {content}
    </button>
  );
}
