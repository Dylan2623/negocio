import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { supabase } from "./supabase";

const CATEGORIES = [
  "Muñecas",
  "Autos",
  "Peluches",
  "Juegos",
  "Didácticos",
  "Creatividad",
  "Otros",
];

const AVAILABILITY = [
  "Disponible",
  "Pocas unidades",
  "Agotado",
];

const DEFAULT_PIN = "1234";

/* =========================================================
   UTILIDADES
========================================================= */

function uid() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function supabaseToProduct(row) {
  return {
    id: row.id,
    name: row.nombre || "",
    price: row.precio ?? "",
    category: row.categoria || "Otros",
    description: row.descripcion || "",

    availability:
      row.estado ||
      (row.disponible ? "Disponible" : "Agotado"),

    featured: Boolean(row.destacado),
    isNew: Boolean(row.nuevo),
    photos: Array.isArray(row.imagenes) ? row.imagenes : [],
  };
}
function productToSupabase(product) {
  return {
    nombre: product.name,
    categoria: product.category,
    precio:
      product.price !== "" && product.price !== null
        ? Number(product.price)
        : null,
    descripcion: product.description || "",

    // Guarda directamente:
    // Disponible / Pocas unidades / Agotado
    disponible: product.availability || "Disponible",

    nuevo: Boolean(product.isNew),
    destacado: Boolean(product.featured),
    imagenes: product.photos || [],
    updated_at: new Date().toISOString(),
  };
}

function currency(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return value;
  }

  return (
    "$" +
    number.toLocaleString("es-AR")
  );
}

function getAvailabilityTone(availability) {
  if (availability === "Disponible") {
    return "verde";
  }

  if (availability === "Pocas unidades") {
    return "sol";
  }

  return "rojo";
}

function getAvailabilityIcon(availability) {
  if (availability === "Disponible") {
    return "🟢";
  }

  if (availability === "Pocas unidades") {
    return "🟡";
  }

  return "🔴";
}

/* =========================================================
   COMPRESIÓN DE IMÁGENES
========================================================= */

function compressImage(
  file,
  maxWidth = 1000,
  quality = 0.78
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(
            (height * maxWidth) / width
          );
          width = maxWidth;
        }

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(
            new Error(
              "No se pudo crear el contexto del canvas."
            )
          );
          return;
        }

        ctx.drawImage(
          img,
          0,
          0,
          width,
          height
        );

        resolve(
          canvas.toDataURL(
            "image/jpeg",
            quality
          )
        );
      };

      img.onerror = reject;
      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   BADGE
========================================================= */

function TicketBadge({
  children,
  tone = "sol",
}) {
  const background =
    tone === "sol"
      ? "var(--ddn-sol)"
      : tone === "rojo"
      ? "var(--ddn-rojo)"
      : "var(--ddn-verde)";

  const foreground =
    tone === "sol"
      ? "var(--ddn-tinta)"
      : "#FFF8EC";

  return (
    <span
      className="ddn-ticket"
      style={{
        background,
        color: foreground,
      }}
    >
      {children}
    </span>
  );
}

/* =========================================================
   DECORACIÓN
========================================================= */

function Balloons() {
  return (
    <div
      className="ddn-balloons"
      aria-hidden="true"
    >
      <span className="ddn-balloon b1">
        🎈
      </span>

      <span className="ddn-balloon b2">
        🎈
      </span>

      <span className="ddn-balloon b3">
        🎈
      </span>

      <span className="ddn-balloon b4">
        ⭐
      </span>

      <span className="ddn-balloon b5">
        🎈
      </span>
    </div>
  );
}

function Bunting() {
  const colors = [
    "#E94F37",
    "#FFC93C",
    "#3AA8E0",
    "#4CA771",
    "#E94F37",
    "#3AA8E0",
    "#FFC93C",
  ];

  return (
    <svg
      className="ddn-bunting"
      viewBox="0 0 700 46"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points="0,4 700,4"
        stroke="#1B2A4A"
        strokeWidth="2"
        fill="none"
      />

      {colors.map((color, index) => {
        const x =
          (700 / colors.length) * index +
          700 / colors.length / 2;

        return (
          <polygon
            key={index}
            points={`${x - 20},6 ${x + 20},6 ${x},40`}
            fill={color}
          />
        );
      })}
    </svg>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState({
    businessName: "Nuestra Juguetería",
    whatsappNumber: "5491100000000",
    pin: DEFAULT_PIN,
  });

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState("Todas");

  const [openProduct, setOpenProduct] =
    useState(null);

  const [galleryIndex, setGalleryIndex] =
    useState(0);

  const [adminOpen, setAdminOpen] =
    useState(false);

  const [pinPromptOpen, setPinPromptOpen] =
    useState(false);

  const [pinInput, setPinInput] =
    useState("");

  const [pinError, setPinError] =
    useState("");

  const [adminTab, setAdminTab] =
    useState("productos");

  const [editingProduct, setEditingProduct] =
    useState(null);

  const [savingPhotos, setSavingPhotos] =
    useState(false);

  const [savingProduct, setSavingProduct] =
    useState(false);

  const [toast, setToast] =
    useState("");

  const catalogRef = useRef(null);

  /* =======================================================
     TOAST
  ======================================================= */

  const showToast = useCallback((message) => {
    setToast(message);

    setTimeout(() => {
      setToast("");
    }, 2400);
  }, []);

  /* =======================================================
     CARGAR AJUSTES
  ======================================================= */

  useEffect(() => {
    try {
      const savedSettings =
        window.localStorage.getItem(
          "ddn:settings"
        );

      if (savedSettings) {
        const parsed =
          JSON.parse(savedSettings);

        setSettings((previous) => ({
          ...previous,
          ...parsed,
        }));
      }
    } catch (error) {
      console.error(
        "Error cargando ajustes:",
        error
      );
    }
  }, []);

  /* =======================================================
     CARGAR PRODUCTOS
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);

      try {
        const {
          data,
          error,
        } = await supabase
          .from("productos")
          .select("*")
          .order("created_at", {
            ascending: false,
          });

        if (error) {
          console.error(
            "Error cargando productos:",
            error
          );

          if (!cancelled) {
            showToast(
              "No se pudieron cargar los productos."
            );
            setLoading(false);
          }

          return;
        }

        if (!cancelled) {
          setProducts(
            (data || []).map(
              supabaseToProduct
            )
          );

          setLoading(false);
        }
      } catch (error) {
        console.error(
          "Error inesperado:",
          error
        );

        if (!cancelled) {
          showToast(
            "Ocurrió un error cargando los productos."
          );

          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  /* =======================================================
     GUARDAR PRODUCTO EN SUPABASE
  ======================================================= */

const persistProduct = useCallback(async (p) => {
  try {
    const payload = {
      nombre: p.name,
      categoria: p.category,
      precio: p.price ? Number(p.price) : null,
      descripcion: p.description || "",

      // Booleano
      disponible: p.availability !== "Agotado",

      // Texto: Disponible / Pocas unidades / Agotado
      estado: p.availability || "Disponible",

      nuevo: Boolean(p.isNew),
      destacado: Boolean(p.featured),
      imagenes: p.photos || [],
    };

    // EDITAR PRODUCTO
    if (p.id && !p.isNewRecord) {
      const { data, error } = await supabase
        .from("productos")
        .update(payload)
        .eq("id", p.id)
        .select()
        .single();

      if (error) {
        console.error("Error actualizando producto:", error);

        return {
          ok: false,
          error,
        };
      }

      return {
        ok: true,
        product: supabaseToProduct(data),
      };
    }

    // CREAR PRODUCTO
    const { data, error } = await supabase
      .from("productos")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creando producto:", error);

      return {
        ok: false,
        error,
      };
    }

    return {
      ok: true,
      product: supabaseToProduct(data),
    };

  } catch (error) {
    console.error("Error guardando producto:", error);

    return {
      ok: false,
      error,
    };
  }
}, []);

  /* =======================================================
     GUARDAR AJUSTES
  ======================================================= */

  const persistSettings = useCallback(
    async (newSettings) => {
      try {
        window.localStorage.setItem(
          "ddn:settings",
          JSON.stringify(newSettings)
        );

        return true;
      } catch (error) {
        console.error(
          "Error guardando ajustes:",
          error
        );

        return false;
      }
    },
    []
  );

  /* =======================================================
     FILTROS
  ======================================================= */

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "Todas" ||
        product.category ===
          activeCategory;

      const normalizedSearch =
        search.trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        product.name
          .toLowerCase()
          .includes(normalizedSearch);

      return (
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    products,
    search,
    activeCategory,
  ]);

  const featuredProducts = useMemo(
    () =>
      products.filter(
        (product) => product.featured
      ),
    [products]
  );

  /* =======================================================
     WHATSAPP
  ======================================================= */

  function waLink(message) {
    const number = (
      settings.whatsappNumber || ""
    ).replace(/[^0-9]/g, "");

    return (
      "https://wa.me/" +
      number +
      "?text=" +
      encodeURIComponent(message)
    );
  }

  function productWaMessage(product) {
    return `Hola! Quisiera consultar por el juguete ${product.name}. ¿Me pueden pasar información y disponibilidad?`;
  }

  function generalWaMessage() {
    return `Hola! Vi el catálogo de juguetes para el Día del Niño y quería consultar.`;
  }

  /* =======================================================
     NAVEGACIÓN
  ======================================================= */

  function scrollToCatalog() {
    catalogRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  /* =======================================================
     ADMIN
  ======================================================= */

  function openAdminGate() {
    setPinInput("");
    setPinError("");
    setPinPromptOpen(true);
  }

  function submitPin() {
    const expected =
      settings.pin || DEFAULT_PIN;

    if (pinInput === expected) {
      setPinPromptOpen(false);
      setAdminOpen(true);
    } else {
      setPinError(
        "PIN incorrecto. Probá de nuevo."
      );
    }
  }

  /* =======================================================
     NUEVO PRODUCTO
  ======================================================= */

  function startNewProduct() {
    setEditingProduct({
      id: uid(),
      name: "",
      price: "",
      category: CATEGORIES[0],
      description: "",
      availability: "Disponible",
      featured: false,
      isNew: true,
      photos: [],
      isNewRecord: true,
    });

    setAdminTab("productos");
  }

  /* =======================================================
     EDITAR PRODUCTO
  ======================================================= */

  function startEditProduct(product) {
    setEditingProduct({
      ...product,
      isNewRecord: false,
    });

    setAdminTab("productos");
  }

  /* =======================================================
     SUBIR FOTOS
  ======================================================= */

  async function handlePhotoUpload(files) {
    if (
      !files ||
      !files.length ||
      !editingProduct
    ) {
      return;
    }

    setSavingPhotos(true);

    const uploadedUrls = [];

    for (const file of Array.from(files)) {
      try {
        const dataUrl =
          await compressImage(file);

        const response =
          await fetch(dataUrl);

        const blob =
          await response.blob();

        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.jpg`;

        const filePath = `${editingProduct.id}/${fileName}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("productos")
          .upload(
            filePath,
            blob,
            {
              contentType:
                "image/jpeg",
              upsert: false,
            }
          );

        if (uploadError) {
          console.error(
            "Error subiendo imagen:",
            uploadError
          );

          continue;
        }

        const { data } =
          supabase.storage
            .from("productos")
            .getPublicUrl(
              filePath
            );

        if (data?.publicUrl) {
          uploadedUrls.push(
            data.publicUrl
          );
        }
      } catch (error) {
        console.error(
          "Error procesando imagen:",
          error
        );
      }
    }

    setEditingProduct((previous) => ({
      ...previous,
      photos: [
        ...(previous.photos || []),
        ...uploadedUrls,
      ],
    }));

    setSavingPhotos(false);

    if (uploadedUrls.length) {
      showToast(
        `${uploadedUrls.length} foto(s) subida(s).`
      );
    } else {
      showToast(
        "No se pudo subir ninguna foto."
      );
    }
  }

  /* =======================================================
     ELIMINAR FOTO
  ======================================================= */

  function removePhoto(index) {
    setEditingProduct((previous) => ({
      ...previous,
      photos: previous.photos.filter(
        (_, photoIndex) =>
          photoIndex !== index
      ),
    }));
  }

  /* =======================================================
     FOTO PRINCIPAL
  ======================================================= */

  function makeMainPhoto(index) {
    setEditingProduct((previous) => {
      const photos = [
        ...(previous.photos || []),
      ];

      const [chosen] =
        photos.splice(index, 1);

      photos.unshift(chosen);

      return {
        ...previous,
        photos,
      };
    });
  }

  /* =======================================================
     GUARDAR EDICIÓN
  ======================================================= */

async function saveEditingProduct() {
  if (!editingProduct.name.trim()) {
    showToast("Poné un nombre para el juguete.");
    return;
  }

  const clean = { ...editingProduct };

  showToast("Guardando juguete...");

  const result = await persistProduct(clean);

  if (!result.ok) {
    console.error("Error de Supabase:", result.error);
    showToast("No se pudo guardar el juguete.");
    return;
  }

  setProducts((prev) => {
    const exists = prev.some(
      (p) => p.id === result.product.id
    );

    if (exists) {
      return prev.map((p) =>
        p.id === result.product.id
          ? result.product
          : p
      );
    }

    return [...prev, result.product];
  });

  showToast("Juguete guardado correctamente.");
  setEditingProduct(null);
}

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="ddn-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap');

        .ddn-app {
          --ddn-sol: #FFC93C;
          --ddn-cielo: #3AA8E0;
          --ddn-rojo: #E94F37;
          --ddn-verde: #4CA771;
          --ddn-tinta: #1B2A4A;
          --ddn-papel: #FFF8EC;

          font-family: 'Nunito', sans-serif;
          background: var(--ddn-papel);
          color: var(--ddn-tinta);

          border-radius: 16px;
          overflow: hidden;

          box-shadow:
            0 1px 0 rgba(27,42,74,0.08);

          width: 100%;
          max-width: 1200px;
          min-height: 100vh;
          margin: 0 auto;
        }

        .ddn-app * {
          box-sizing: border-box;
        }

        .ddn-app h1,
        .ddn-app h2,
        .ddn-app h3,
        .ddn-app .ddn-display {
          font-family: 'Baloo 2', sans-serif;
        }

        /* HERO */

        .ddn-hero {
          position: relative;

          background:
            linear-gradient(
              180deg,
              var(--ddn-cielo) 0%,
              #6FC3EE 100%
            );

          padding: 0 20px 28px;
          overflow: hidden;
        }

        .ddn-bunting {
          width: 100%;
          display: block;
          height: 40px;
        }

        .ddn-balloons {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .ddn-balloon {
          position: absolute;
          font-size: 26px;
          opacity: 0.85;

          animation:
            ddnFloat
            6s
            ease-in-out
            infinite;
        }

        .b1 {
          left: 6%;
          top: 20%;
          animation-delay: 0s;
          font-size: 22px;
        }

        .b2 {
          right: 8%;
          top: 12%;
          animation-delay: 1.2s;
          font-size: 30px;
        }

        .b3 {
          left: 18%;
          top: 55%;
          animation-delay: 2.1s;
          font-size: 18px;
        }

        .b4 {
          right: 20%;
          top: 45%;
          animation-delay: 0.6s;
          font-size: 16px;
        }

        .b5 {
          right: 40%;
          top: 8%;
          animation-delay: 1.8s;
          font-size: 20px;
        }

        @keyframes ddnFloat {
          0%, 100% {
            transform:
              translateY(0px)
              rotate(-3deg);
          }

          50% {
            transform:
              translateY(-10px)
              rotate(3deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ddn-balloon {
            animation: none;
          }
        }

        .ddn-hero-inner {
          position: relative;
          text-align: center;
          padding-top: 6px;
        }

        .ddn-eyebrow {
          display: inline-block;

          background:
            var(--ddn-rojo);

          color: #FFF8EC;

          font-weight: 700;
          font-size: 12px;

          letter-spacing: 0.06em;
          text-transform: uppercase;

          padding: 5px 12px;
          border-radius: 999px;

          margin-bottom: 14px;
        }

        .ddn-hero h1 {
          font-size: 26px;
          font-weight: 800;

          line-height: 1.2;

          margin:
            0 0 10px;

          color:
            var(--ddn-tinta);

          text-shadow:
            0 2px 0
            rgba(255,255,255,0.4);
        }

        .ddn-hero p {
          font-size: 14px;
          margin: 0 0 18px;

          color: #0F2540;
          font-weight: 600;

          opacity: 0.85;
        }

        .ddn-cta {
          background:
            var(--ddn-rojo);

          color: #FFF8EC;

          border: none;

          font-family:
            'Baloo 2',
            sans-serif;

          font-weight: 700;
          font-size: 16px;

          padding:
            12px 28px;

          border-radius: 999px;

          cursor: pointer;

          box-shadow:
            0 4px 0 #A9331F;

          transition:
            transform 0.1s;
        }

        .ddn-cta:active {
          transform:
            translateY(3px);

          box-shadow:
            0 1px 0 #A9331F;
        }

        /* BUSCADOR */

        .ddn-search-wrap {
          position: sticky;
          top: 0;
          z-index: 20;

          background:
            var(--ddn-papel);

          padding:
            12px 16px;

          border-bottom:
            2px dashed
            rgba(27,42,74,0.15);
        }

        .ddn-search {
          width: 100%;

          padding:
            10px 14px;

          border-radius: 12px;

          border:
            2px solid
            rgba(27,42,74,0.15);

          font-family:
            'Nunito',
            sans-serif;

          font-size: 14px;

          background: #fff;

          color:
            var(--ddn-tinta);
        }

        .ddn-search:focus {
          outline: none;

          border-color:
            var(--ddn-cielo);
        }

        .ddn-chips {
          display: flex;

          gap: 8px;

          overflow-x: auto;

          padding:
            10px 16px 4px;

          scrollbar-width: none;
        }

        .ddn-chips::-webkit-scrollbar {
          display: none;
        }

        .ddn-chip {
          flex: 0 0 auto;

          padding:
            7px 14px;

          border-radius: 999px;

          border:
            2px solid
            var(--ddn-tinta);

          background: #fff;

          color:
            var(--ddn-tinta);

          font-weight: 700;
          font-size: 13px;

          cursor: pointer;

          white-space: nowrap;
        }

        .ddn-chip.active {
          background:
            var(--ddn-tinta);

          color: #fff;
        }

        /* SECCIONES */

        .ddn-section-title {
          font-size: 16px;
          font-weight: 700;

          margin:
            18px 16px 10px;

          display: flex;
          align-items: center;

          gap: 6px;
        }

        .ddn-featured-scroll {
          display: flex;
          gap: 12px;

          overflow-x: auto;

          padding:
            0 16px 6px;

          scrollbar-width: none;
        }

        .ddn-featured-scroll::-webkit-scrollbar {
          display: none;
        }

        .ddn-featured-card {
          flex:
            0 0 150px;
        }

        .ddn-grid {
          display: grid;

          grid-template-columns:
            1fr 1fr;

          gap: 12px;

          padding:
            4px 16px 20px;
        }

        /* CARD */

        .ddn-card {
          background: #fff;

          border-radius: 14px;

          border:
            1px solid
            rgba(27,42,74,0.08);

          overflow: hidden;

          cursor: pointer;

          display: flex;

          flex-direction: column;

          box-shadow:
            0 2px 6px
            rgba(27,42,74,0.06);
        }

        .ddn-card-img {
          aspect-ratio: 1 / 1;

          background:
            linear-gradient(
              135deg,
              #FFE7A8,
              #FFD5B0
            );

          display: flex;

          align-items: center;
          justify-content: center;

          font-size: 34px;

          position: relative;

          overflow: hidden;
        }

        .ddn-card-img img {
          width: 100%;
          height: 100%;

          object-fit: cover;
        }

        .ddn-card-badges {
          position: absolute;

          top: 6px;
          left: 6px;

          display: flex;

          flex-direction: column;

          gap: 4px;
        }

        .ddn-ticket {
          font-family:
            'Baloo 2',
            sans-serif;

          font-weight: 700;
          font-size: 10.5px;

          padding:
            3px 8px 3px 10px;

          border-radius: 3px;

          position: relative;

          letter-spacing: 0.02em;
        }

        .ddn-ticket::before,
        .ddn-ticket::after {
          content: "";

          position: absolute;

          width: 6px;
          height: 6px;

          background:
            var(--ddn-papel);

          border-radius: 50%;

          top: 50%;

          transform:
            translateY(-50%);
        }

        .ddn-ticket::before {
          left: -3px;
        }

        .ddn-ticket::after {
          right: -3px;
        }

        .ddn-card-body {
          padding:
            10px 10px 12px;

          display: flex;

          flex-direction: column;

          gap: 4px;

          flex: 1;
        }

        .ddn-card-cat {
          font-size: 10.5px;

          color:
            var(--ddn-cielo);

          font-weight: 700;

          text-transform:
            uppercase;

          letter-spacing: 0.03em;
        }

        .ddn-card-name {
          font-size: 13.5px;

          font-weight: 700;

          line-height: 1.3;

          color:
            var(--ddn-tinta);

          min-height: 34px;
        }

        .ddn-card-price {
          font-family:
            'Baloo 2',
            sans-serif;

          font-weight: 700;

          font-size: 15px;

          color:
            var(--ddn-rojo);
        }

        .ddn-card-availability {
          font-size: 11px;
          font-weight: 800;

          margin:
            2px 0 4px;
        }

        .availability-green {
          color:
            var(--ddn-verde);
        }

        .availability-yellow {
          color:
            #C28B00;
        }

        .availability-red {
          color:
            var(--ddn-rojo);
        }

        .ddn-wa-btn {
          margin-top: auto;

          display: flex;

          align-items: center;
          justify-content: center;

          gap: 6px;

          background:
            var(--ddn-verde);

          color: #fff;

          border: none;

          border-radius: 10px;

          padding:
            8px 6px;

          font-weight: 700;

          font-size: 12px;

          cursor: pointer;

          font-family:
            'Nunito',
            sans-serif;
        }

        /* EMPTY */

        .ddn-empty {
          text-align: center;

          padding:
            40px 20px;

          color:
            rgba(27,42,74,0.6);
        }

        .ddn-empty .emoji {
          font-size: 40px;

          display: block;

          margin-bottom: 10px;
        }

        /* WHATSAPP */

        .ddn-fab {
          position: sticky;

          bottom: 14px;

          margin-left: auto;
          margin-right: 14px;

          width: fit-content;

          background:
            var(--ddn-verde);

          color: #fff;

          border: none;

          border-radius: 999px;

          padding:
            12px 18px;

          font-weight: 800;

          font-size: 14px;

          display: flex;

          align-items: center;

          gap: 8px;

          cursor: pointer;

          box-shadow:
            0 4px 12px
            rgba(27,42,74,0.25);

          font-family:
            'Baloo 2',
            sans-serif;

          z-index: 30;
        }

        /* FOOTER */

        .ddn-footer {
          text-align: center;

          padding: 16px;

          font-size: 11px;

          color:
            rgba(27,42,74,0.45);
        }

        .ddn-gear {
          background: none;

          border: none;

          color:
            rgba(27,42,74,0.3);

          font-size: 16px;

          cursor: pointer;

          padding:
            4px 8px;
        }

        /* OVERLAY */

        .ddn-overlay {
          position: fixed;

          inset: 0;

          background:
            rgba(27,42,74,0.55);

          z-index: 100;

          display: flex;

          align-items: flex-end;

          justify-content: center;
        }

        .ddn-sheet {
          background:
            var(--ddn-papel);

          width: 100%;

          max-width: 480px;

          border-radius:
            20px 20px 0 0;

          max-height: 88vh;

          overflow-y: auto;

          padding:
            18px 18px 26px;

          position: relative;
        }

        .ddn-sheet-close {
          position: sticky;

          top: 0;

          float: right;

          background:
            rgba(27,42,74,0.08);

          border: none;

          border-radius: 50%;

          width: 30px;
          height: 30px;

          font-size: 15px;

          cursor: pointer;

          color:
            var(--ddn-tinta);
        }

        /* GALERÍA */

        .ddn-gallery-main {
          width: 100%;

          aspect-ratio: 1 / 1;

          border-radius: 14px;

          overflow: hidden;

          background: #FFE7A8;

          margin-bottom: 8px;

          display: flex;

          align-items: center;
          justify-content: center;

          font-size: 50px;
        }

        .ddn-gallery-main img {
          width: 100%;
          height: 100%;

          object-fit: cover;
        }

        .ddn-gallery-thumbs {
          display: flex;

          gap: 6px;

          margin-bottom: 14px;

          overflow-x: auto;
        }

        .ddn-gallery-thumbs img {
          width: 52px;
          height: 52px;

          object-fit: cover;

          border-radius: 8px;

          cursor: pointer;

          border:
            2px solid transparent;

          flex-shrink: 0;
        }

        .ddn-gallery-thumbs img.active {
          border-color:
            var(--ddn-cielo);
        }

        .ddn-detail-name {
          font-size: 20px;

          font-weight: 800;

          margin:
            4px 0 6px;
        }

        .ddn-detail-price {
          font-family:
            'Baloo 2',
            sans-serif;

          color:
            var(--ddn-rojo);

          font-size: 22px;

          font-weight: 700;

          margin-bottom: 8px;
        }

        .ddn-detail-desc {
          font-size: 14px;

          line-height: 1.5;

          color:
            rgba(27,42,74,0.8);

          margin-bottom: 14px;
        }

        .ddn-detail-row {
          display: flex;

          gap: 8px;

          margin-bottom: 16px;

          flex-wrap: wrap;
        }

        .ddn-big-wa {
          width: 100%;

          background:
            var(--ddn-verde);

          color: #fff;

          border: none;

          border-radius: 14px;

          padding: 14px;

          font-weight: 800;

          font-size: 15px;

          cursor: pointer;

          font-family:
            'Baloo 2',
            sans-serif;

          margin-bottom: 8px;
        }

        .ddn-share-btn {
          width: 100%;

          background: #fff;

          color:
            var(--ddn-tinta);

          border:
            2px solid
            rgba(27,42,74,0.15);

          border-radius: 14px;

          padding: 11px;

          font-weight: 700;

          font-size: 13px;

          cursor: pointer;
        }

        /* FORMULARIOS */

        .ddn-form-label {
          font-size: 12px;

          font-weight: 700;

          margin:
            12px 0 4px;

          display: block;
        }

        .ddn-form-input,
        .ddn-form-select,
        .ddn-form-textarea {
          width: 100%;

          padding:
            9px 12px;

          border-radius: 10px;

          border:
            2px solid
            rgba(27,42,74,0.15);

          font-family:
            'Nunito',
            sans-serif;

          font-size: 14px;

          background: #fff;

          color:
            var(--ddn-tinta);
        }

        .ddn-form-input:focus,
        .ddn-form-select:focus,
        .ddn-form-textarea:focus {
          outline: none;

          border-color:
            var(--ddn-cielo);
        }

        .ddn-form-textarea {
          min-height: 70px;

          resize: vertical;
        }

        .ddn-check-row {
          display: flex;

          align-items: center;

          gap: 8px;

          margin:
            8px 0;

          font-size: 13px;

          font-weight: 700;
        }

        /* FOTOS */

        .ddn-photo-grid {
          display: flex;

          flex-wrap: wrap;

          gap: 8px;

          margin-top: 8px;
        }

        .ddn-photo-thumb {
          position: relative;

          width: 64px;
          height: 64px;

          border-radius: 10px;

          overflow: hidden;

          cursor: pointer;
        }

        .ddn-photo-thumb img {
          width: 100%;
          height: 100%;

          object-fit: cover;
        }

        .ddn-photo-thumb .rm {
          position: absolute;

          top: 2px;
          right: 2px;

          background:
            var(--ddn-rojo);

          color: #fff;

          border: none;

          width: 18px;
          height: 18px;

          border-radius: 50%;

          font-size: 11px;

          cursor: pointer;

          line-height: 1;
        }

        .ddn-photo-thumb .main-flag {
          position: absolute;

          bottom: 2px;
          left: 2px;

          background:
            var(--ddn-sol);

          color:
            var(--ddn-tinta);

          font-size: 9px;

          font-weight: 800;

          padding:
            1px 4px;

          border-radius: 4px;
        }

        .ddn-upload-btn {
          border:
            2px dashed
            rgba(27,42,74,0.25);

          border-radius: 10px;

          width: 64px;
          height: 64px;

          display: flex;

          align-items: center;
          justify-content: center;

          font-size: 20px;

          color:
            rgba(27,42,74,0.4);

          cursor: pointer;

          background: none;
        }

        .ddn-upload-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        /* BOTONES */

        .ddn-save-btn {
          width: 100%;

          background:
            var(--ddn-tinta);

          color: #fff;

          border: none;

          border-radius: 12px;

          padding: 12px;

          font-weight: 800;

          font-size: 14px;

          cursor: pointer;

          margin-top: 16px;

          font-family:
            'Baloo 2',
            sans-serif;
        }

        .ddn-save-btn:disabled {
          opacity: 0.6;

          cursor: wait;
        }

        .ddn-danger-btn {
          width: 100%;

          background: none;

          color:
            var(--ddn-rojo);

          border:
            2px solid
            var(--ddn-rojo);

          border-radius: 12px;

          padding: 10px;

          font-weight: 700;

          font-size: 13px;

          cursor: pointer;

          margin-top: 8px;
        }

        /* ADMIN */

        .ddn-admin-list-item {
          display: flex;

          align-items: center;

          gap: 10px;

          padding: 10px;

          background: #fff;

          border-radius: 12px;

          margin-bottom: 8px;

          border:
            1px solid
            rgba(27,42,74,0.08);
        }

        .ddn-admin-list-item .thumb {
          width: 44px;
          height: 44px;

          border-radius: 8px;

          overflow: hidden;

          background: #FFE7A8;

          flex-shrink: 0;

          display: flex;

          align-items: center;
          justify-content: center;

          font-size: 18px;
        }

        .ddn-admin-list-item .thumb img {
          width: 100%;
          height: 100%;

          object-fit: cover;
        }

        .ddn-admin-list-item .info {
          flex: 1;

          min-width: 0;
        }

        .ddn-admin-list-item .info .n {
          font-size: 13px;

          font-weight: 700;
        }

        .ddn-admin-list-item .info .c {
          font-size: 11px;

          color:
            rgba(27,42,74,0.5);
        }

        .ddn-admin-list-item .edit-btn {
          background: none;

          border: none;

          font-size: 16px;

          cursor: pointer;
        }

        .ddn-tabbar {
          display: flex;

          gap: 6px;

          margin-bottom: 14px;
        }

        .ddn-tabbtn {
          flex: 1;

          padding: 8px;

          border-radius: 10px;

          border:
            2px solid
            var(--ddn-tinta);

          background: #fff;

          font-weight: 700;

          font-size: 12px;

          cursor: pointer;
        }

        .ddn-tabbtn.active {
          background:
            var(--ddn-tinta);

          color: #fff;
        }

        /* PIN */

        .ddn-pin-input {
          width: 100%;

          text-align: center;

          letter-spacing: 0.3em;

          font-size: 20px;

          padding: 12px;

          border-radius: 10px;

          border:
            2px solid
            rgba(27,42,74,0.2);

          margin-bottom: 8px;
        }

        /* TOAST */

        .ddn-toast {
          position: fixed;

          bottom: 16px;
          left: 50%;

          transform:
            translateX(-50%);

          background:
            var(--ddn-tinta);

          color: #fff;

          padding:
            10px 18px;

          border-radius: 999px;

          font-size: 13px;

          font-weight: 700;

          z-index: 200;

          max-width: 90%;

          text-align: center;
        }

        .ddn-loading {
          text-align: center;

          padding:
            60px 20px;

          font-weight: 700;

          color:
            rgba(27,42,74,0.5);
        }

        /* =================================================
           TABLET
        ================================================= */

        @media (min-width: 600px) {
          .ddn-hero {
            padding-left: 32px;
            padding-right: 32px;
          }

          .ddn-hero-inner {
            max-width: 820px;
            margin: 0 auto;
          }

          .ddn-hero h1 {
            font-size: 34px;
          }

          .ddn-hero p {
            font-size: 16px;
          }

          .ddn-search-wrap {
            padding-left: 32px;
            padding-right: 32px;
          }

          .ddn-chips {
            padding-left: 0;
            padding-right: 0;
            justify-content: center;
          }

          .ddn-section-title {
            margin-left: 32px;
            margin-right: 32px;
            font-size: 19px;
          }

          .ddn-featured-scroll {
            padding-left: 32px;
            padding-right: 32px;
          }

          .ddn-featured-card {
            flex-basis: 190px;
          }

          .ddn-grid {
            grid-template-columns:
              repeat(
                3,
                minmax(0, 1fr)
              );

            gap: 18px;

            padding-left: 32px;
            padding-right: 32px;
          }

          .ddn-card-name {
            font-size: 15px;
          }

          .ddn-card-price {
            font-size: 17px;
          }
        }

        /* =================================================
           PC
        ================================================= */

        @media (min-width: 900px) {
          .ddn-app {
            border-radius: 0;
            box-shadow: none;
          }

          .ddn-hero {
            padding:
              0 56px 42px;
          }

          .ddn-hero-inner {
            max-width: 950px;

            padding-top: 18px;
          }

          .ddn-hero h1 {
            font-size: 44px;

            max-width: 850px;

            margin-left: auto;
            margin-right: auto;
          }

          .ddn-hero p {
            font-size: 18px;
          }

          .ddn-cta {
            font-size: 18px;

            padding:
              13px 34px;
          }

          .ddn-search-wrap {
            padding:
              16px 56px;
          }

          .ddn-search {
            display: block;

            max-width: 760px;

            margin: 0 auto;

            padding:
              12px 16px;

            font-size: 15px;
          }

          .ddn-chips {
            max-width: 1100px;

            margin: 0 auto;

            justify-content: center;
          }

          .ddn-section-title {
            max-width: 1088px;

            margin:
              24px auto 12px;

            padding: 0;

            font-size: 21px;
          }

          .ddn-featured-scroll {
            max-width: 1088px;

            margin: 0 auto;

            padding:
              0 0 8px;
          }

          .ddn-featured-card {
            flex-basis: 210px;
          }

          .ddn-grid {
            max-width: 1088px;

            margin: 0 auto;

            grid-template-columns:
              repeat(
                4,
                minmax(0, 1fr)
              );

            gap: 20px;

            padding:
              6px 0 28px;
          }

          .ddn-card {
            transition:
              transform 0.18s ease,
              box-shadow 0.18s ease;
          }

          .ddn-card:hover {
            transform:
              translateY(-3px);

            box-shadow:
              0 8px 20px
              rgba(27,42,74,0.12);
          }

          .ddn-card-name {
            font-size: 15px;
          }

          .ddn-card-price {
            font-size: 18px;
          }

          .ddn-footer {
            padding:
              24px 56px;
          }

          .ddn-fab {
            position: fixed;

            right: 28px;
            bottom: 24px;

            margin: 0;
          }

          .ddn-sheet {
            max-width: 720px;

            max-height: 90vh;

            border-radius: 20px;

            margin-bottom: 20px;
          }
        }

        /* =================================================
           PANTALLAS GRANDES
        ================================================= */

        @media (min-width: 1200px) {
          .ddn-hero h1 {
            font-size: 48px;
          }

          .ddn-grid {
            grid-template-columns:
              repeat(
                5,
                minmax(0, 1fr)
              );
          }
        }

        /* =================================================
           CELULARES PEQUEÑOS
        ================================================= */

        @media (max-width: 380px) {
          .ddn-hero {
            padding-left: 14px;
            padding-right: 14px;
          }

          .ddn-hero h1 {
            font-size: 23px;
          }

          .ddn-hero p {
            font-size: 13px;
          }

          .ddn-grid {
            gap: 8px;

            padding-left: 10px;
            padding-right: 10px;
          }

          .ddn-card-body {
            padding:
              8px 8px 10px;
          }

          .ddn-card-name {
            font-size: 12.5px;
          }

          .ddn-card-price {
            font-size: 14px;
          }

          .ddn-wa-btn {
            font-size: 11px;
          }
        }

        /* =================================================
           MÓVILES
        ================================================= */

        @media (max-width: 599px) {
          .ddn-app {
            border-radius: 0;
          }

          .ddn-sheet {
            max-width: 100%;
          }

          .ddn-search-wrap {
            position: sticky;
            top: 0;
          }

          .ddn-hero h1 {
            max-width: 340px;

            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>

      {/* ===================================================
          HERO
      =================================================== */}

      <div className="ddn-hero">
        <Bunting />
        <Balloons />

        <div className="ddn-hero-inner">
          <span className="ddn-eyebrow">
            Día del Niño
          </span>

          <h1>
            🎁 Encontrá el regalo perfecto
            para este Día del Niño
          </h1>

          <p>
            {settings.businessName}
          </p>

          <button
            className="ddn-cta"
            onClick={scrollToCatalog}
          >
            Ver juguetes
          </button>
        </div>
      </div>

      {/* ===================================================
          BUSCADOR
      =================================================== */}

      <div className="ddn-search-wrap">
        <input
          className="ddn-search"
          placeholder="Buscar un juguete..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <div className="ddn-chips">
          {[
            "Todas",
            ...CATEGORIES,
          ].map((category) => (
            <button
              key={category}
              className={
                "ddn-chip" +
                (activeCategory ===
                category
                  ? " active"
                  : "")
              }
              onClick={() =>
                setActiveCategory(
                  category
                )
              }
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* ===================================================
          CONTENIDO
      =================================================== */}

      {loading ? (
        <div className="ddn-loading">
          Cargando juguetes...
        </div>
      ) : (
        <>
          {/* DESTACADOS */}

          {featuredProducts.length >
            0 && (
            <>
              <div className="ddn-section-title">
                ⭐ Recomendados para regalar
              </div>

              <div className="ddn-featured-scroll">
                {featuredProducts.map(
                  (product) => (
                    <div
                      key={product.id}
                      className="ddn-featured-card"
                    >
                      <ProductCard
                        p={product}
                        onOpen={() => {
                          setOpenProduct(
                            product
                          );
                          setGalleryIndex(
                            0
                          );
                        }}
                        onWhatsapp={() =>
                          window.open(
                            waLink(
                              productWaMessage(
                                product
                              )
                            ),
                            "_blank"
                          )
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* CATÁLOGO */}

          <div
            ref={catalogRef}
            className="ddn-section-title"
          >
            🧸 Catálogo
          </div>

          {filteredProducts.length ===
          0 ? (
            <div className="ddn-empty">
              <span className="emoji">
                🔍
              </span>

              No encontramos juguetes con
              esa búsqueda. Probá con otra
              palabra o categoría.
            </div>
          ) : (
            <div className="ddn-grid">
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    p={product}
                    onOpen={() => {
                      setOpenProduct(
                        product
                      );
                      setGalleryIndex(
                        0
                      );
                    }}
                    onWhatsapp={() =>
                      window.open(
                        waLink(
                          productWaMessage(
                            product
                          )
                        ),
                        "_blank"
                      )
                    }
                  />
                )
              )}
            </div>
          )}

          {/* WHATSAPP */}

          <button
            className="ddn-fab"
            onClick={() =>
              window.open(
                waLink(
                  generalWaMessage()
                ),
                "_blank"
              )
            }
          >
            💬 Consultar por WhatsApp
          </button>

          {/* FOOTER */}

          <div className="ddn-footer">
            {settings.businessName} ·
            Catálogo Día del Niño{" "}

            <button
              className="ddn-gear"
              onClick={
                openAdminGate
              }
              aria-label="Administrar catálogo"
            >
              ⚙
            </button>
          </div>
        </>
      )}

      {/* ===================================================
          DETALLE DEL PRODUCTO
      =================================================== */}

      {openProduct && (
        <div
          className="ddn-overlay"
          onClick={() =>
            setOpenProduct(null)
          }
        >
          <div
            className="ddn-sheet"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="ddn-sheet-close"
              onClick={() =>
                setOpenProduct(null)
              }
            >
              ✕
            </button>

            <div
              style={{ clear: "both" }}
            />

            <div className="ddn-gallery-main">
              {openProduct.photos.length >
              0 ? (
                <img
                  src={
                    openProduct.photos[
                      galleryIndex
                    ]
                  }
                  alt={openProduct.name}
                />
              ) : (
                "🧸"
              )}
            </div>

            {openProduct.photos.length >
              1 && (
              <div className="ddn-gallery-thumbs">
                {openProduct.photos.map(
                  (photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt=""
                      className={
                        index ===
                        galleryIndex
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setGalleryIndex(
                          index
                        )
                      }
                    />
                  )
                )}
              </div>
            )}

            <div className="ddn-detail-row">
              {openProduct.isNew && (
                <TicketBadge tone="rojo">
                  🆕 Nuevo
                </TicketBadge>
              )}

              {openProduct.featured && (
                <TicketBadge tone="sol">
                  ⭐ Destacado
                </TicketBadge>
              )}

              <TicketBadge
                tone={getAvailabilityTone(
                  openProduct.availability
                )}
              >
                {getAvailabilityIcon(
                  openProduct.availability
                )}{" "}
                {openProduct.availability}
              </TicketBadge>
            </div>

            <div className="ddn-detail-name">
              {openProduct.name}
            </div>

            {currency(
              openProduct.price
            ) && (
              <div className="ddn-detail-price">
                {currency(
                  openProduct.price
                )}
              </div>
            )}

            {openProduct.description && (
              <div className="ddn-detail-desc">
                {
                  openProduct.description
                }
              </div>
            )}

            <button
              className="ddn-big-wa"
              onClick={() =>
                window.open(
                  waLink(
                    productWaMessage(
                      openProduct
                    )
                  ),
                  "_blank"
                )
              }
            >
              💬 Consultar por WhatsApp
            </button>

            <button
              className="ddn-share-btn"
              onClick={() =>
                shareProduct(
                  openProduct
                )
              }
            >
              Compartir
            </button>
          </div>
        </div>
      )}

      {/* ===================================================
          PIN
      =================================================== */}

      {pinPromptOpen && (
        <div
          className="ddn-overlay"
          onClick={() =>
            setPinPromptOpen(false)
          }
        >
          <div
            className="ddn-sheet"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              maxWidth: 320,
              borderRadius: 20,
            }}
          >
            <button
              className="ddn-sheet-close"
              onClick={() =>
                setPinPromptOpen(false)
              }
            >
              ✕
            </button>

            <div
              style={{ clear: "both" }}
            />

            <h3
              style={{
                marginTop: 0,
              }}
            >
              Panel de administración
            </h3>

            <p
              style={{
                fontSize: 13,
                color:
                  "rgba(27,42,74,0.7)",
              }}
            >
              Ingresá el PIN.

              {settings.pin ===
                DEFAULT_PIN &&
                " PIN inicial: 1234 (cambialo en Ajustes)."}
            </p>

            <input
              className="ddn-pin-input"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(event) =>
                setPinInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  submitPin();
                }
              }}
              autoFocus
            />

            {pinError && (
              <div
                style={{
                  color:
                    "var(--ddn-rojo)",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {pinError}
              </div>
            )}

            <button
              className="ddn-save-btn"
              onClick={submitPin}
            >
              Entrar
            </button>
          </div>
        </div>
      )}

      {/* ===================================================
          ADMIN
      =================================================== */}

      {adminOpen && (
        <div
          className="ddn-overlay"
          onClick={() => {
            setAdminOpen(false);
            setEditingProduct(null);
          }}
        >
          <div
            className="ddn-sheet"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="ddn-sheet-close"
              onClick={() => {
                setAdminOpen(false);
                setEditingProduct(null);
              }}
            >
              ✕
            </button>

            <div
              style={{ clear: "both" }}
            />

            <h3
              style={{
                marginTop: 0,
              }}
            >
              Administrar catálogo
            </h3>

            <div className="ddn-tabbar">
              <button
                className={
                  "ddn-tabbtn" +
                  (adminTab ===
                  "productos"
                    ? " active"
                    : "")
                }
                onClick={() => {
                  setAdminTab(
                    "productos"
                  );
                  setEditingProduct(
                    null
                  );
                }}
              >
                Productos
              </button>

              <button
                className={
                  "ddn-tabbtn" +
                  (adminTab ===
                  "ajustes"
                    ? " active"
                    : "")
                }
                onClick={() => {
                  setAdminTab(
                    "ajustes"
                  );
                  setEditingProduct(
                    null
                  );
                }}
              >
                Ajustes
              </button>
            </div>

            {/* LISTA */}

            {adminTab ===
              "productos" &&
              !editingProduct && (
                <>
                  <button
                    className="ddn-save-btn"
                    onClick={
                      startNewProduct
                    }
                  >
                    + Agregar juguete
                  </button>

                  <div
                    style={{
                      marginTop: 14,
                    }}
                  >
                    {products.map(
                      (product) => (
                        <div
                          key={product.id}
                          className="ddn-admin-list-item"
                        >
                          <div className="thumb">
                            {product
                              .photos[0] ? (
                              <img
                                src={
                                  product
                                    .photos[0]
                                }
                                alt=""
                              />
                            ) : (
                              "🧸"
                            )}
                          </div>

                          <div className="info">
                            <div className="n">
                              {
                                product.name
                              }
                            </div>

                            <div className="c">
                              {
                                product.category
                              }
                              {" · "}
                              {currency(
                                product.price
                              ) || "Sin precio"}
                              {" · "}
                              {
                                product.availability
                              }
                            </div>
                          </div>

                          <button
                            className="edit-btn"
                            onClick={() =>
                              startEditProduct(
                                product
                              )
                            }
                          >
                            ✏️
                          </button>
                        </div>
                      )
                    )}

                    {products.length ===
                      0 && (
                      <div className="ddn-empty">
                        Todavía no cargaste
                        juguetes.
                      </div>
                    )}
                  </div>
                </>
              )}

            {/* FORMULARIO */}

            {adminTab ===
              "productos" &&
              editingProduct && (
                <ProductForm
                  product={
                    editingProduct
                  }
                  setProduct={
                    setEditingProduct
                  }
                  onUpload={
                    handlePhotoUpload
                  }
                  onRemovePhoto={
                    removePhoto
                  }
                  onMakeMain={
                    makeMainPhoto
                  }
                  savingPhotos={
                    savingPhotos
                  }
                  savingProduct={
                    savingProduct
                  }
                  onSave={
                    saveEditingProduct
                  }
                  onDelete={() =>
                    deleteProduct(
                      editingProduct.id
                    )
                  }
                  onCancel={() =>
                    setEditingProduct(
                      null
                    )
                  }
                />
              )}

            {/* AJUSTES */}

            {adminTab ===
              "ajustes" && (
              <SettingsForm
                settings={settings}
                onSave={
                  saveSettingsForm
                }
              />
            )}
          </div>
        </div>
      )}

      {/* TOAST */}

      {toast && (
        <div className="ddn-toast">
          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PRODUCT CARD
========================================================= */

function ProductCard({
  p,
  onOpen,
  onWhatsapp,
}) {
  const availabilityClass =
    p.availability ===
    "Disponible"
      ? "availability-green"
      : p.availability ===
        "Pocas unidades"
      ? "availability-yellow"
      : "availability-red";

  return (
    <div
      className="ddn-card"
      onClick={onOpen}
    >
      <div className="ddn-card-img">
        {p.photos[0] ? (
          <img
            src={p.photos[0]}
            alt={p.name}
          />
        ) : (
          "🧸"
        )}

        <div className="ddn-card-badges">
          {p.isNew && (
            <TicketBadge tone="rojo">
              🆕 Nuevo
            </TicketBadge>
          )}

          {p.featured && (
            <TicketBadge tone="sol">
              ⭐
            </TicketBadge>
          )}
        </div>
      </div>

      <div className="ddn-card-body">
        <span className="ddn-card-cat">
          {p.category}
        </span>

        <span className="ddn-card-name">
          {p.name}
        </span>

        {currency(p.price) && (
          <span className="ddn-card-price">
            {currency(p.price)}
          </span>
        )}

        <span
          className={
            "ddn-card-availability " +
            availabilityClass
          }
        >
          {getAvailabilityIcon(
            p.availability
          )}{" "}
          {p.availability}
        </span>

        <button
          className="ddn-wa-btn"
          onClick={(event) => {
            event.stopPropagation();
            onWhatsapp();
          }}
        >
          💬 Consultar
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   FORMULARIO PRODUCTO
========================================================= */

function ProductForm({
  product,
  setProduct,
  onUpload,
  onRemovePhoto,
  onMakeMain,
  savingPhotos,
  savingProduct,
  onSave,
  onDelete,
  onCancel,
}) {
  const fileRef = useRef(null);

  return (
    <div>
      <label className="ddn-form-label">
        Nombre
      </label>

      <input
        className="ddn-form-input"
        value={product.name}
        onChange={(event) =>
          setProduct({
            ...product,
            name: event.target.value,
          })
        }
        placeholder="Nombre del juguete"
      />

      <label className="ddn-form-label">
        Precio (opcional)
      </label>

      <input
        className="ddn-form-input"
        value={product.price}
        onChange={(event) =>
          setProduct({
            ...product,
            price: event.target.value,
          })
        }
        placeholder="Ej: 5000"
        inputMode="numeric"
      />

      <label className="ddn-form-label">
        Categoría
      </label>

      <select
        className="ddn-form-select"
        value={product.category}
        onChange={(event) =>
          setProduct({
            ...product,
            category:
              event.target.value,
          })
        }
      >
        {CATEGORIES.map(
          (category) => (
            <option
              key={category}
              value={category}
            >
              {category}
            </option>
          )
        )}
      </select>

      <label className="ddn-form-label">
        Descripción (opcional)
      </label>

      <textarea
        className="ddn-form-textarea"
        value={product.description}
        onChange={(event) =>
          setProduct({
            ...product,
            description:
              event.target.value,
          })
        }
        placeholder="Detalles del juguete"
      />

      {/* =================================================
          DISPONIBILIDAD
      ================================================= */}

      <label className="ddn-form-label">
        Disponibilidad
      </label>

      <select
        className="ddn-form-select"
        value={product.availability}
        onChange={(event) =>
          setProduct({
            ...product,
            availability:
              event.target.value,
          })
        }
      >
        {AVAILABILITY.map(
          (availability) => (
            <option
              key={availability}
              value={availability}
            >
              {getAvailabilityIcon(
                availability
              )}{" "}
              {availability}
            </option>
          )
        )}
      </select>

      <div className="ddn-check-row">
        <input
          type="checkbox"
          checked={Boolean(
            product.featured
          )}
          onChange={(event) =>
            setProduct({
              ...product,
              featured:
                event.target.checked,
            })
          }
          id="feat"
        />

        <label htmlFor="feat">
          ⭐ Destacar en
          "Recomendados"
        </label>
      </div>

      <div className="ddn-check-row">
        <input
          type="checkbox"
          checked={Boolean(
            product.isNew
          )}
          onChange={(event) =>
            setProduct({
              ...product,
              isNew:
                event.target.checked,
            })
          }
          id="isnew"
        />

        <label htmlFor="isnew">
          🆕 Marcar como nuevo
        </label>
      </div>

      {/* =================================================
          FOTOS
      ================================================= */}

      <label className="ddn-form-label">
        Fotos
        <span
          style={{
            fontWeight: 600,
            opacity: 0.6,
          }}
        >
          {" "}
          (tocá una para hacerla principal)
        </span>
      </label>

      <div className="ddn-photo-grid">
        {(product.photos || []).map(
          (photo, index) => (
            <div
              key={index}
              className="ddn-photo-thumb"
              onClick={() =>
                onMakeMain(index)
              }
            >
              <img
                src={photo}
                alt=""
              />

              {index === 0 && (
                <span className="main-flag">
                  Principal
                </span>
              )}

              <button
                className="rm"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemovePhoto(
                    index
                  );
                }}
              >
                ✕
              </button>
            </div>
          )
        )}

        <button
          type="button"
          className="ddn-upload-btn"
          onClick={() =>
            fileRef.current?.click()
          }
          disabled={savingPhotos}
        >
          {savingPhotos ? "…" : "+"}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            onUpload(
              event.target.files
            );

            event.target.value = "";
          }}
        />
      </div>

      {/* =================================================
          GUARDAR
      ================================================= */}

      <button
        className="ddn-save-btn"
        onClick={onSave}
        disabled={
          savingProduct ||
          savingPhotos
        }
      >
        {savingProduct
          ? "Guardando..."
          : "Guardar juguete"}
      </button>

      {!product.isNewRecord && (
        <button
          className="ddn-danger-btn"
          onClick={onDelete}
        >
          Eliminar juguete
        </button>
      )}

      <button
        className="ddn-share-btn"
        style={{
          marginTop: 8,
        }}
        onClick={onCancel}
      >
        Cancelar
      </button>
    </div>
  );
}

/* =========================================================
   AJUSTES
========================================================= */

function SettingsForm({
  settings,
  onSave,
}) {
  const [form, setForm] =
    useState(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  return (
    <div>
      <label className="ddn-form-label">
        Nombre del negocio
      </label>

      <input
        className="ddn-form-input"
        value={form.businessName}
        onChange={(event) =>
          setForm({
            ...form,
            businessName:
              event.target.value,
          })
        }
      />

      <label className="ddn-form-label">
        Número de WhatsApp
        <span
          style={{
            fontWeight: 600,
            opacity: 0.6,
          }}
        >
          {" "}
          (con código de país,
          sin +)
        </span>
      </label>

      <input
        className="ddn-form-input"
        value={form.whatsappNumber}
        onChange={(event) =>
          setForm({
            ...form,
            whatsappNumber:
              event.target.value,
          })
        }
        placeholder="5491100000000"
      />

      <label className="ddn-form-label">
        PIN de administración
      </label>

      <input
        className="ddn-form-input"
        value={form.pin}
        onChange={(event) =>
          setForm({
            ...form,
            pin: event.target.value,
          })
        }
        placeholder="4 a 8 dígitos"
        inputMode="numeric"
        maxLength={8}
      />

      <button
        className="ddn-save-btn"
        onClick={() =>
          onSave(form)
        }
      >
        Guardar ajustes
      </button>
    </div>
  );
}