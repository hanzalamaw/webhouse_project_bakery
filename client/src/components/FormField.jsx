import { useT } from "../context/LanguageContext";

export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  as: Component = "input",
  children,
  displayOnly = false,
  ...rest
}) {
  const t = useT();
  const labelText = typeof label === "string" ? t(label) : label;
  const placeholderText = typeof placeholder === "string" ? t(placeholder) : placeholder;
  const errorText = typeof error === "string" ? t(error) : error;
  const ariaLabel =
    typeof rest["aria-label"] === "string" ? t(rest["aria-label"]) : rest["aria-label"];

  const inputClass = displayOnly
    ? "wh-field__input wh-field__input--display"
    : `wh-field__input${rest.readOnly ? " wh-field__input--readonly" : ""}`;

  const fieldRest = { ...rest, "aria-label": ariaLabel };

  return (
    <div className={`wh-field${error ? " wh-field--error" : ""}`}>
      {labelText ? (
        <label className="wh-field__label" htmlFor={id}>
          {labelText}
        </label>
      ) : null}
      {displayOnly ? (
        <div id={id} className={inputClass} aria-readonly="true">
          {value ?? ""}
        </div>
      ) : Component === "select" ? (
        <select
          id={id}
          className={`wh-field__input${rest.readOnly ? " wh-field__input--readonly" : ""}`}
          value={value}
          onChange={onChange}
          {...fieldRest}
        >
          {children}
        </select>
      ) : Component === "textarea" ? (
        <textarea
          id={id}
          className={`wh-field__input wh-field__textarea${rest.readOnly ? " wh-field__input--readonly" : ""}`}
          value={value}
          onChange={onChange}
          placeholder={placeholderText}
          {...fieldRest}
        />
      ) : (
        <input
          id={id}
          type={type}
          className={`wh-field__input${rest.readOnly ? " wh-field__input--readonly" : ""}`}
          value={value}
          onChange={onChange}
          placeholder={placeholderText}
          autoComplete={autoComplete ?? "off"}
          {...fieldRest}
        />
      )}
      {errorText ? <span className="wh-field__error">{errorText}</span> : null}
    </div>
  );
}
