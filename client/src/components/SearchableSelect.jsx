import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "../context/LanguageContext";

export function SearchableSelect({
  id: idProp,
  label,
  value,
  onChange,
  options = [],
  placeholder = "",
  loading = false,
  disabled = false,
  emptyMessage = "No matches",
  allowEmpty = false,
  emptyOptionLabel = "No one",
  error,
}) {
  const t = useT();
  const autoId = useId();
  const id = idProp || autoId;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const labelText = typeof label === "string" ? t(label) : label;
  const placeholderText = typeof placeholder === "string" ? t(placeholder) : placeholder;
  const emptyMessageText = typeof emptyMessage === "string" ? t(emptyMessage) : emptyMessage;
  const emptyOptionLabelText = typeof emptyOptionLabel === "string" ? t(emptyOptionLabel) : emptyOptionLabel;
  const loadingText = t("Loading…");
  const errorText = typeof error === "string" ? t(error) : error;

  const listOptions = useMemo(() => {
    if (!allowEmpty) return options;
    return [{ value: "", label: emptyOptionLabelText }, ...options.filter((o) => o.value !== "")];
  }, [allowEmpty, emptyOptionLabelText, options]);

  const selected = useMemo(
    () => (value === "" || value == null ? null : listOptions.find((o) => o.value === value) || null),
    [listOptions, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listOptions;
    return listOptions.filter(
      (o) =>
        o.value.toLowerCase().includes(q) ||
        (o.label && o.label.toLowerCase().includes(q))
    );
  }, [listOptions, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const displayValue = open ? query : (selected?.label || "");

  const pick = (option) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    inputRef.current?.focus();
  };

  const openList = () => {
    if (disabled || loading) return;
    setOpen(true);
    setQuery("");
  };

  const closeIfFocusLeft = () => {
    requestAnimationFrame(() => {
      if (!rootRef.current?.contains(document.activeElement)) {
        setOpen(false);
        setQuery("");
      }
    });
  };

  return (
    <div className={`wh-field wh-search-select${error ? " wh-field--error" : ""}`} ref={rootRef} onBlur={closeIfFocusLeft}>
      {labelText ? (
        <label className="wh-field__label" htmlFor={id}>
          {labelText}
        </label>
      ) : null}
      <div className={`wh-search-select__control${open ? " open" : ""}${disabled ? " disabled" : ""}`}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="wh-field__input wh-search-select__input"
          value={loading ? loadingText : displayValue}
          placeholder={loading ? loadingText : (open ? placeholderText || "Type to search…" : (selected?.label ? "" : placeholderText))}
          disabled={disabled || loading}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => openList()}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) openList();
              const buttons = rootRef.current?.querySelectorAll(".wh-search-select__option");
              if (!buttons?.length) return;
              const active = document.activeElement;
              const idx = [...buttons].indexOf(active);
              let next = 0;
              if (e.key === "ArrowDown") next = idx < 0 ? 0 : Math.min(idx + 1, buttons.length - 1);
              else next = idx < 0 ? buttons.length - 1 : Math.max(idx - 1, 0);
              buttons[next]?.focus();
              return;
            }
            if (e.key === "Enter" && filtered[0]) {
              e.preventDefault();
              pick(filtered[0]);
            }
            if (e.key === "Tab") {
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <button
          type="button"
          className="wh-search-select__toggle"
          tabIndex={-1}
          disabled={disabled || loading}
          aria-label={open ? "Close list" : "Open list"}
          onClick={() => {
            if (disabled || loading) return;
            if (open) {
              setOpen(false);
              setQuery("");
            } else {
              openList();
              inputRef.current?.focus();
            }
          }}
        >
          ▾
        </button>
      </div>
      {open && !loading && (
        <ul className="wh-search-select__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="wh-search-select__empty">{emptyMessageText}</li>
          ) : (
            filtered.slice(0, 120).map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  tabIndex={-1}
                  className={`wh-search-select__option${option.value === value ? " selected" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(option)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setOpen(false);
                      inputRef.current?.focus();
                      return;
                    }
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const buttons = rootRef.current?.querySelectorAll(".wh-search-select__option");
                      if (!buttons?.length) return;
                      const idx = [...buttons].indexOf(e.currentTarget);
                      const next =
                        e.key === "ArrowDown"
                          ? Math.min(idx + 1, buttons.length - 1)
                          : Math.max(idx - 1, 0);
                      buttons[next]?.focus();
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(option);
                    }
                    if (e.key === "Tab") setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {errorText ? <span className="wh-field__error">{errorText}</span> : null}
    </div>
  );
}
