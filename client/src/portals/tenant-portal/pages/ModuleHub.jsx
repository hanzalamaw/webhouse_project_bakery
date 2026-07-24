import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useT } from "../../../context/LanguageContext";
import { Button } from "../../../components/Button";
import { moduleBasePath } from "../modules/registry";
import { useTenantModules } from "../hooks/useTenantModules";
import heroImage from "../../../assets/Main top-right Image.png";
import adminImage from "../../../assets/Admin.png";
import orderImage from "../../../assets/Order Management.png";
import posImage from "../../../assets/POS.png";
import crmImage from "../../../assets/CRM.png";
import financeImage from "../../../assets/Finance & Accounting.png";
import inventoryImage from "../../../assets/Inventory & Procurement.png";
import "./ModuleHub.css";

const MODULE_IMAGES = {
  admin: adminImage,
  "stock-purchasing": inventoryImage,
  production: inventoryImage,
  pos: posImage,
  "pos-terminal": posImage,
  "order-management": orderImage,
  crm: crmImage,
  finance: financeImage,
};

const MODULE_LABEL_KEYS = {
  admin: "module.admin",
  "stock-purchasing": "module.stock",
  production: "module.production",
  pos: "module.pos",
  "pos-terminal": "module.posTerminal",
  "order-management": "module.orders",
  crm: "module.crm",
  finance: "module.finance",
};

const MODULE_DESC_KEYS = {
  admin: "module.admin.desc",
  "stock-purchasing": "module.stock.desc",
  production: "module.production.desc",
  pos: "module.pos.desc",
  "pos-terminal": "module.posTerminal.desc",
  "order-management": "module.orders.desc",
  crm: "module.crm.desc",
  finance: "module.finance.desc",
};

const POS_LAST_SLUGS = ["pos", "pos-terminal"];

function sortModulesWithPosLast(modules) {
  const regular = [];
  const posModules = [];

  for (const mod of modules) {
    if (POS_LAST_SLUGS.includes(mod.slug)) {
      posModules.push(mod);
    } else {
      regular.push(mod);
    }
  }

  posModules.sort(
    (a, b) => POS_LAST_SLUGS.indexOf(a.slug) - POS_LAST_SLUGS.indexOf(b.slug)
  );

  return [...regular, ...posModules];
}

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return "hub.greetingMorning";
  if (hour < 17) return "hub.greetingAfternoon";
  return "hub.greetingEvening";
}

function getDisplayName(user) {
  const name = user?.name || user?.username || "";
  return name.split(" ")[0] || "there";
}

export default function ModuleHub() {
  const { user, logout } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const { visible, loading, error } = useTenantModules();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = !query
      ? visible
      : visible.filter((mod) => {
          const label = t(MODULE_LABEL_KEYS[mod.slug] || "module.admin");
          const description = t(MODULE_DESC_KEYS[mod.slug] || "module.admin.desc");
          return (
            mod.name.toLowerCase().includes(query) ||
            label.toLowerCase().includes(query) ||
            description.toLowerCase().includes(query)
          );
        });
    return sortModulesWithPosLast(base);
  }, [visible, search, t]);

  const handleLogout = async () => {
    await logout();
    if (!user?.impersonating) {
      navigate(`/${user?.login_portal || "erp1"}`);
    }
  };

  return (
    <div className="wh-module-hub">
      <div className="wh-module-hub__center">
        <div className="wh-module-hub__inner">
        <div className="wh-module-hub__topbar">
          <Button type="button" variant="secondary" className="wh-btn--sm" onClick={handleLogout}>
            {t("hub.logout")}
          </Button>
        </div>
        <header className="wh-module-hub__header">
          <div className="wh-module-hub__intro">            <p className="wh-module-hub__greeting">
              <span className="wh-module-hub__greeting-icon" aria-hidden>
                <svg viewBox="0 0 14 14" fill="none">
                  <path d="M7 0L14 7L7 14L0 7L7 0Z" fill="currentColor" />
                </svg>
              </span>
              {t(getGreetingKey())}, {getDisplayName(user)} 👋
            </p>
            <h1 className="wh-module-hub__title">{t("hub.selectModule")}</h1>
            <p className="wh-module-hub__subtitle">
              {t("hub.subtitle")}
            </p>
            <div className="wh-module-hub__search">
              <span className="wh-module-hub__search-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                type="search"
                className="wh-module-hub__search-input"
                placeholder={t("hub.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t("hub.searchAria")}
              />
            </div>
          </div>
          <div className="wh-module-hub__hero" aria-hidden>
            <img src={heroImage} alt="" className="wh-module-hub__hero-img" />
          </div>
        </header>

        {error && <p className="wh-field__error">{error}</p>}
        {loading && <p className="wh-module-hub__status">{t("hub.loading")}</p>}

        {!loading && !error && visible.length === 0 && (
          <p className="wh-module-hub__status">{t("hub.noneEnabled")}</p>
        )}

        {!loading && visible.length > 0 && filtered.length === 0 && (
          <p className="wh-module-hub__status">{t("hub.noMatch")}</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="wh-module-grid">
            {filtered.map((mod, index) => (
                <button
                  key={mod.slug}
                  type="button"
                  className="wh-module-card"
                  onClick={() => navigate(`${moduleBasePath(mod.slug)}/dashboard`)}
                >
                  <img
                    src={MODULE_IMAGES[mod.slug]}
                    alt=""
                    className="wh-module-card__image"
                  />
                  <div className="wh-module-card__content">
                    <h2 className="wh-module-card__title">
                      {index + 1}. {t(MODULE_LABEL_KEYS[mod.slug] || "module.admin")}
                    </h2>
                    <p className="wh-module-card__desc">
                      {t(MODULE_DESC_KEYS[mod.slug] || "module.admin.desc")}
                    </p>
                  </div>
                  <span className="wh-module-card__arrow" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </span>
                </button>
            ))}
          </div>
        )}

        <footer className="wh-module-hub__footer">
          <span className="wh-module-hub__footer-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18 6 2.25v4.66c0 4.16-2.84 8.02-6 9.01-3.16-.99-6-3.85-6-9.01V6.43l6-2.25z" />
            </svg>
          </span>
          {t("hub.footer")}
        </footer>
        </div>
      </div>
    </div>
  );
}
