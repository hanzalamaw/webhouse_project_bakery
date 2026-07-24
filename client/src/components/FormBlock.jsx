import { useT } from "../context/LanguageContext";

export function FormBlock({ title, description, children }) {
  const t = useT();
  const titleText = typeof title === "string" ? t(title) : title;
  const descText = typeof description === "string" ? t(description) : description;

  return (
    <div className="wh-form-block">
      <div className="wh-form-block__header">
        <div>
          <h3 className="wh-form-block__title">{titleText}</h3>
          {descText ? <p className="wh-form-block__desc">{descText}</p> : null}
        </div>
      </div>
      <div className="wh-form-block__body">{children}</div>
    </div>
  );
}
