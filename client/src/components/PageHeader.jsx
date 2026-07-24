import { useT } from "../context/LanguageContext";

export function PageHeader({ title, description, actions }) {
  const t = useT();
  const titleText = typeof title === "string" ? t(title) : title;
  const descText = typeof description === "string" ? t(description) : description;

  return (
    <header className="wh-page-header">
      <div>
        <h1 className="wh-page-header__title">{titleText}</h1>
        {descText ? <p className="wh-page-header__desc">{descText}</p> : null}
      </div>
      {actions && <div className="wh-page-header__actions">{actions}</div>}
    </header>
  );
}
