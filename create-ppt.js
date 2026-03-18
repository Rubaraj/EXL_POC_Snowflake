const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// Icon imports
const {
  FaDatabase,
  FaCloud,
  FaExchangeAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaSync,
  FaShieldAlt,
  FaCogs,
  FaServer,
  FaArrowRight,
} = require("react-icons/fa");

// ── Icon helper ──
function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

// ── Color palette: Midnight Executive ──
const C = {
  navy: "1E2761",
  darkNavy: "141C3D",
  iceBlue: "CADCFC",
  white: "FFFFFF",
  lightGray: "F0F2F8",
  medGray: "8B95B0",
  accent: "3B82F6",   // bright blue accent
  green: "22C55E",
  red: "EF4444",
  amber: "F59E0B",
  teal: "0EA5E9",
  darkText: "1E293B",
  bodyText: "334155",
};

// ── Helper: fresh shadow ──
const cardShadow = () => ({
  type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.1,
});

// ── Slide builder helpers ──
function addSlideBg(slide, dark = false) {
  slide.background = { color: dark ? C.darkNavy : C.lightGray };
}

function addHeader(slide, title) {
  slide.addText(title, {
    x: 0.7, y: 0.3, w: 8.6, h: 0.6,
    fontSize: 30, fontFace: "Trebuchet MS", bold: true,
    color: C.navy, margin: 0,
  });
  // subtle line
  slide.addShape("line", {
    x: 0.7, y: 0.95, w: 2.0, h: 0,
    line: { color: C.accent, width: 3 },
  });
}

function addFooterBar(slide) {
  slide.addShape("rectangle", {
    x: 0, y: 5.35, w: 10, h: 0.275,
    fill: { color: C.navy },
  });
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "EXL POC";
  pres.title = "Real-Time Data Sync: MongoDB to Snowflake";

  // Pre-render icons
  const icons = {
    db: await iconToBase64Png(FaDatabase, "#" + C.white, 256),
    dbDark: await iconToBase64Png(FaDatabase, "#" + C.accent, 256),
    cloud: await iconToBase64Png(FaCloud, "#" + C.white, 256),
    cloudDark: await iconToBase64Png(FaCloud, "#" + C.accent, 256),
    exchange: await iconToBase64Png(FaExchangeAlt, "#" + C.white, 256),
    check: await iconToBase64Png(FaCheckCircle, "#" + C.green, 256),
    cross: await iconToBase64Png(FaTimesCircle, "#" + C.red, 256),
    sync: await iconToBase64Png(FaSync, "#" + C.accent, 256),
    shield: await iconToBase64Png(FaShieldAlt, "#" + C.accent, 256),
    cogs: await iconToBase64Png(FaCogs, "#" + C.white, 256),
    server: await iconToBase64Png(FaServer, "#" + C.white, 256),
    arrow: await iconToBase64Png(FaArrowRight, "#" + C.iceBlue, 256),
    arrowDark: await iconToBase64Png(FaArrowRight, "#" + C.accent, 256),
    checkWhite: await iconToBase64Png(FaCheckCircle, "#" + C.white, 256),
  };

  // ═══════════════════════════════════════
  // SLIDE 1 — Title
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s, true);

    // Top accent bar
    s.addShape("rectangle", {
      x: 0, y: 0, w: 10, h: 0.06,
      fill: { color: C.accent },
    });

    // Icons cluster
    s.addImage({ data: icons.db, x: 1.5, y: 1.2, w: 0.55, h: 0.55 });
    s.addImage({ data: icons.arrow, x: 2.35, y: 1.3, w: 0.35, h: 0.35 });
    s.addImage({ data: icons.exchange, x: 3.0, y: 1.2, w: 0.55, h: 0.55 });
    s.addImage({ data: icons.arrow, x: 3.85, y: 1.3, w: 0.35, h: 0.35 });
    s.addImage({ data: icons.cloud, x: 4.5, y: 1.2, w: 0.55, h: 0.55 });

    // Title
    s.addText("Real-Time Data Sync", {
      x: 0.7, y: 2.1, w: 8.6, h: 0.8,
      fontSize: 40, fontFace: "Trebuchet MS", bold: true,
      color: C.white, margin: 0,
    });
    s.addText("MongoDB to Snowflake", {
      x: 0.7, y: 2.8, w: 8.6, h: 0.7,
      fontSize: 34, fontFace: "Trebuchet MS",
      color: C.iceBlue, margin: 0,
    });

    // Subtitle
    s.addText("Proof of Concept \u2014 Edge-to-Cloud Pipeline with High Availability", {
      x: 0.7, y: 3.7, w: 8.6, h: 0.5,
      fontSize: 16, fontFace: "Calibri",
      color: C.medGray, margin: 0,
    });

    // Footer
    s.addShape("rectangle", {
      x: 0, y: 5.1, w: 10, h: 0.525,
      fill: { color: C.navy },
    });
    s.addText("March 2026  |  EXL POC", {
      x: 0.7, y: 5.15, w: 8.6, h: 0.45,
      fontSize: 13, fontFace: "Calibri",
      color: C.medGray, margin: 0,
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 2 — The Problem
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "The Challenge");
    addFooterBar(s);

    const items = [
      { icon: icons.dbDark, text: "Edge/branch systems generate data that must reach the cloud warehouse in real time" },
      { icon: icons.cross, text: "Direct database-to-database replication is fragile \u2014 any network interruption loses data" },
      { icon: icons.sync, text: "Traditional batch ETL introduces hours of delay" },
      { icon: icons.shield, text: "Need a solution that is resilient, real-time, and cost-effective" },
    ];

    items.forEach((item, i) => {
      const yBase = 1.35 + i * 0.95;
      // Card background
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 8.6, h: 0.8,
        fill: { color: C.white },
        shadow: cardShadow(),
      });
      // Left accent bar
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 0.06, h: 0.8,
        fill: { color: i === 1 ? C.red : (i === 3 ? C.green : C.accent) },
      });
      // Icon
      s.addImage({ data: item.icon, x: 1.0, y: yBase + 0.18, w: 0.4, h: 0.4 });
      // Text
      s.addText(item.text, {
        x: 1.6, y: yBase, w: 7.5, h: 0.8,
        fontSize: 15, fontFace: "Calibri", color: C.bodyText,
        valign: "middle", margin: 0,
      });
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 3 — The Solution
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "Our Approach: Event-Driven Streaming");
    addFooterBar(s);

    const bullets = [
      "Use MongoDB Change Streams to capture every insert, update, and delete as it happens",
      "Stream changes through Apache Kafka as a durable, fault-tolerant message bus",
      "Kafka Snowflake Sink Connector delivers data to Snowflake via Snowpipe",
      "If the cloud side goes down, Kafka queues all messages \u2014 zero data loss",
    ];

    const iconList = [icons.dbDark, icons.arrowDark, icons.cloudDark, icons.shield];

    bullets.forEach((text, i) => {
      const yBase = 1.35 + i * 0.95;
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 8.6, h: 0.8,
        fill: { color: C.white },
        shadow: cardShadow(),
      });
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 0.06, h: 0.8,
        fill: { color: C.accent },
      });
      s.addImage({ data: iconList[i], x: 1.0, y: yBase + 0.18, w: 0.4, h: 0.4 });
      s.addText(text, {
        x: 1.6, y: yBase, w: 7.5, h: 0.8,
        fontSize: 15, fontFace: "Calibri", color: C.bodyText,
        valign: "middle", margin: 0,
      });
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 4 — Architecture Diagram
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "Architecture Overview");
    addFooterBar(s);

    // Edge Device box
    s.addShape("rectangle", {
      x: 0.5, y: 1.5, w: 3.0, h: 2.8,
      fill: { color: C.white },
      shadow: cardShadow(),
    });
    s.addShape("rectangle", {
      x: 0.5, y: 1.5, w: 3.0, h: 0.5,
      fill: { color: C.navy },
    });
    s.addText("Edge Device", {
      x: 0.5, y: 1.5, w: 3.0, h: 0.5,
      fontSize: 14, fontFace: "Trebuchet MS", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });

    // Edge items
    s.addImage({ data: icons.dbDark, x: 0.85, y: 2.25, w: 0.4, h: 0.4 });
    s.addText("MongoDB", {
      x: 1.35, y: 2.25, w: 2.0, h: 0.4,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.darkText,
      valign: "middle", margin: 0,
    });
    s.addImage({ data: icons.arrowDark, x: 0.85, y: 2.85, w: 0.4, h: 0.4 });
    s.addText("Kafka Source\nConnector", {
      x: 1.35, y: 2.75, w: 2.0, h: 0.6,
      fontSize: 13, fontFace: "Calibri", bold: true, color: C.darkText,
      valign: "middle", margin: 0,
    });

    // Arrow: Edge → Hub
    s.addShape("rectangle", {
      x: 3.65, y: 2.75, w: 0.9, h: 0.04,
      fill: { color: C.accent },
    });
    // Triangle arrow head
    s.addText("\u25B6", {
      x: 4.35, y: 2.55, w: 0.3, h: 0.5,
      fontSize: 16, color: C.accent, align: "center", valign: "middle", margin: 0,
    });
    s.addText("Network", {
      x: 3.55, y: 2.35, w: 1.2, h: 0.35,
      fontSize: 10, fontFace: "Calibri", color: C.medGray,
      align: "center", valign: "middle", margin: 0,
    });

    // Central Hub box
    s.addShape("rectangle", {
      x: 4.7, y: 1.5, w: 3.0, h: 2.8,
      fill: { color: C.white },
      shadow: cardShadow(),
    });
    s.addShape("rectangle", {
      x: 4.7, y: 1.5, w: 3.0, h: 0.5,
      fill: { color: C.navy },
    });
    s.addText("Central Hub", {
      x: 4.7, y: 1.5, w: 3.0, h: 0.5,
      fontSize: 14, fontFace: "Trebuchet MS", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });

    // Hub items
    s.addImage({ data: icons.arrowDark, x: 5.05, y: 2.2, w: 0.35, h: 0.35 });
    s.addText("Apache Kafka (KRaft)", {
      x: 5.5, y: 2.2, w: 2.1, h: 0.35,
      fontSize: 12, fontFace: "Calibri", bold: true, color: C.darkText,
      valign: "middle", margin: 0,
    });
    s.addImage({ data: icons.arrowDark, x: 5.05, y: 2.7, w: 0.35, h: 0.35 });
    s.addText("Kafka Sink Connector", {
      x: 5.5, y: 2.7, w: 2.1, h: 0.35,
      fontSize: 12, fontFace: "Calibri", bold: true, color: C.darkText,
      valign: "middle", margin: 0,
    });
    s.addImage({ data: icons.arrowDark, x: 5.05, y: 3.2, w: 0.35, h: 0.35 });
    s.addText("Kafka UI", {
      x: 5.5, y: 3.2, w: 2.1, h: 0.35,
      fontSize: 12, fontFace: "Calibri", bold: true, color: C.darkText,
      valign: "middle", margin: 0,
    });

    // Arrow: Hub → Cloud
    s.addShape("rectangle", {
      x: 7.85, y: 2.75, w: 0.6, h: 0.04,
      fill: { color: C.accent },
    });
    s.addText("\u25B6", {
      x: 8.3, y: 2.55, w: 0.3, h: 0.5,
      fontSize: 16, color: C.accent, align: "center", valign: "middle", margin: 0,
    });

    // Cloud box
    s.addShape("rectangle", {
      x: 8.5, y: 2.0, w: 1.2, h: 1.6,
      fill: { color: C.accent },
      shadow: cardShadow(),
    });
    s.addImage({ data: icons.cloud, x: 8.85, y: 2.15, w: 0.5, h: 0.5 });
    s.addText("Snowflake\n(Cloud DW)", {
      x: 8.5, y: 2.7, w: 1.2, h: 0.7,
      fontSize: 11, fontFace: "Calibri", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 5 — Tech Stack
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "Technology Stack");
    addFooterBar(s);

    // Edge column
    s.addShape("rectangle", {
      x: 0.7, y: 1.3, w: 4.15, h: 3.6,
      fill: { color: C.white },
      shadow: cardShadow(),
    });
    s.addShape("rectangle", {
      x: 0.7, y: 1.3, w: 4.15, h: 0.5,
      fill: { color: C.navy },
    });
    s.addImage({ data: icons.server, x: 0.95, y: 1.37, w: 0.3, h: 0.3 });
    s.addText("Edge", {
      x: 1.35, y: 1.3, w: 3.0, h: 0.5,
      fontSize: 16, fontFace: "Trebuchet MS", bold: true,
      color: C.white, valign: "middle", margin: 0,
    });

    const edgeItems = [
      "MongoDB 7.0",
      "Kafka Connect + MongoDB\nSource Connector 1.13.1",
      "Docker & Docker Compose",
    ];
    edgeItems.forEach((text, i) => {
      s.addImage({ data: icons.check, x: 1.0, y: 2.1 + i * 0.85, w: 0.3, h: 0.3 });
      s.addText(text, {
        x: 1.5, y: 2.0 + i * 0.85, w: 3.1, h: 0.55,
        fontSize: 14, fontFace: "Calibri", color: C.bodyText,
        valign: "middle", margin: 0,
      });
    });

    // Hub column
    s.addShape("rectangle", {
      x: 5.15, y: 1.3, w: 4.15, h: 3.6,
      fill: { color: C.white },
      shadow: cardShadow(),
    });
    s.addShape("rectangle", {
      x: 5.15, y: 1.3, w: 4.15, h: 0.5,
      fill: { color: C.navy },
    });
    s.addImage({ data: icons.cogs, x: 5.4, y: 1.37, w: 0.3, h: 0.3 });
    s.addText("Hub", {
      x: 5.8, y: 1.3, w: 3.0, h: 0.5,
      fontSize: 16, fontFace: "Trebuchet MS", bold: true,
      color: C.white, valign: "middle", margin: 0,
    });

    const hubItems = [
      "Apache Kafka 3.8.1 (KRaft mode)",
      "Kafka Connect + Snowflake\nSink Connector 2.4.0",
      "Kafka UI",
      "Docker & Docker Compose",
    ];
    hubItems.forEach((text, i) => {
      s.addImage({ data: icons.check, x: 5.45, y: 2.1 + i * 0.7, w: 0.3, h: 0.3 });
      s.addText(text, {
        x: 5.95, y: 2.0 + i * 0.7, w: 3.1, h: 0.55,
        fontSize: 14, fontFace: "Calibri", color: C.bodyText,
        valign: "middle", margin: 0,
      });
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 6 — Data Flow & Configuration
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "How Data Flows");
    addFooterBar(s);

    const steps = [
      "Application inserts/updates a document in MongoDB",
      "MongoDB Change Stream emits a change event",
      "Kafka Source Connector captures the event and publishes to a Kafka topic",
      "Kafka Sink Connector consumes from the topic and stages data to Snowflake",
      "Snowpipe loads the staged data into the target table within ~60 seconds",
    ];

    steps.forEach((text, i) => {
      const yBase = 1.25 + i * 0.52;
      // Number circle
      s.addShape("oval", {
        x: 0.7, y: yBase + 0.02, w: 0.35, h: 0.35,
        fill: { color: C.accent },
      });
      s.addText(String(i + 1), {
        x: 0.7, y: yBase + 0.02, w: 0.35, h: 0.35,
        fontSize: 13, fontFace: "Calibri", bold: true,
        color: C.white, align: "center", valign: "middle", margin: 0,
      });
      // Text
      s.addText(text, {
        x: 1.2, y: yBase, w: 8.1, h: 0.4,
        fontSize: 13, fontFace: "Calibri", color: C.bodyText,
        valign: "middle", margin: 0,
      });
    });

    // Config callout box
    s.addShape("rectangle", {
      x: 0.7, y: 3.95, w: 8.6, h: 1.25,
      fill: { color: C.white },
      shadow: cardShadow(),
    });
    s.addShape("rectangle", {
      x: 0.7, y: 3.95, w: 0.06, h: 1.25,
      fill: { color: C.amber },
    });
    s.addText("Key Configuration Decisions", {
      x: 1.0, y: 3.98, w: 8.0, h: 0.3,
      fontSize: 13, fontFace: "Trebuchet MS", bold: true,
      color: C.navy, margin: 0,
    });
    s.addText([
      { text: "Database-level watching: Source connector monitors ALL collections automatically", options: { bullet: true, breakLine: true } },
      { text: "Regex topic subscription: Sink connector auto-subscribes to new collections", options: { bullet: true, breakLine: true } },
      { text: "Single-broker Kafka with KRaft mode \u2014 no Zookeeper dependency", options: { bullet: true } },
    ], {
      x: 1.0, y: 4.28, w: 8.1, h: 0.9,
      fontSize: 12, fontFace: "Calibri", color: C.bodyText,
      margin: 0, paraSpaceAfter: 4,
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 7 — High Availability Scenario
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "What Happens When the Cloud Goes Down?");
    addFooterBar(s);

    const phases = [
      { label: "Normal", color: C.green, desc: "MongoDB \u2192 Kafka \u2192 Snowflake", icon: icons.check },
      { label: "Break", color: C.red, desc: "Kafka + Snowflake offline.\nMongoDB keeps accepting data.", icon: icons.cross },
      { label: "Recovery", color: C.accent, desc: "Kafka + Snowflake back online.\nAuto re-sync all queued data.", icon: icons.sync },
      { label: "Verified", color: C.green, desc: "All records in Snowflake.\nZero data loss.", icon: icons.check },
    ];

    phases.forEach((p, i) => {
      const xBase = 0.5 + i * 2.4;

      // Card
      s.addShape("rectangle", {
        x: xBase, y: 1.5, w: 2.1, h: 3.0,
        fill: { color: C.white },
        shadow: cardShadow(),
      });

      // Top color bar
      s.addShape("rectangle", {
        x: xBase, y: 1.5, w: 2.1, h: 0.06,
        fill: { color: p.color },
      });

      // Phase label
      s.addText("Phase " + (i + 1), {
        x: xBase, y: 1.65, w: 2.1, h: 0.3,
        fontSize: 10, fontFace: "Calibri", color: C.medGray,
        align: "center", valign: "middle", margin: 0,
      });
      s.addText(p.label, {
        x: xBase, y: 1.9, w: 2.1, h: 0.35,
        fontSize: 18, fontFace: "Trebuchet MS", bold: true,
        color: C.navy, align: "center", valign: "middle", margin: 0,
      });

      // Icon
      s.addImage({ data: p.icon, x: xBase + 0.75, y: 2.45, w: 0.55, h: 0.55 });

      // Description
      s.addText(p.desc, {
        x: xBase + 0.15, y: 3.15, w: 1.8, h: 1.0,
        fontSize: 11, fontFace: "Calibri", color: C.bodyText,
        align: "center", valign: "top", margin: 0,
      });

      // Arrow between cards
      if (i < 3) {
        s.addText("\u25B6", {
          x: xBase + 2.1, y: 2.7, w: 0.3, h: 0.4,
          fontSize: 14, color: C.accent, align: "center", valign: "middle", margin: 0,
        });
      }
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 8 — Live Test Results
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "Availability Test Results");
    addFooterBar(s);

    const headerRow = [
      { text: "Phase", options: { fill: { color: C.navy }, color: C.white, bold: true, fontSize: 13, fontFace: "Trebuchet MS", align: "center", valign: "middle" } },
      { text: "Action", options: { fill: { color: C.navy }, color: C.white, bold: true, fontSize: 13, fontFace: "Trebuchet MS", align: "center", valign: "middle" } },
      { text: "Result", options: { fill: { color: C.navy }, color: C.white, bold: true, fontSize: 13, fontFace: "Trebuchet MS", align: "center", valign: "middle" } },
    ];

    const makeRow = (phase, action, result, bg) => [
      { text: phase, options: { fill: { color: bg }, fontSize: 12, fontFace: "Calibri", color: C.darkText, bold: true, valign: "middle" } },
      { text: action, options: { fill: { color: bg }, fontSize: 12, fontFace: "Calibri", color: C.bodyText, valign: "middle" } },
      { text: result, options: { fill: { color: bg }, fontSize: 12, fontFace: "Calibri", color: C.green, bold: true, align: "center", valign: "middle" } },
    ];

    const tableData = [
      headerRow,
      makeRow("Baseline", "3 seed orders in MongoDB \u2192 3 rows in Snowflake", "PASS", C.white),
      makeRow("During Outage", "Inserted 5 orders while Kafka was down \u2014 MongoDB accepted all 5", "PASS", C.lightGray),
      makeRow("Recovery", "Restarted Kafka + Sink \u2192 All 8 records (3+5) in Snowflake", "PASS", C.white),
      makeRow("Latency", "Time from recovery to full sync: Under 90 seconds", "PASS", C.lightGray),
    ];

    s.addTable(tableData, {
      x: 0.7, y: 1.4, w: 8.6,
      colW: [1.8, 5.2, 1.6],
      border: { pt: 0.5, color: "D0D5E0" },
      rowH: [0.5, 0.6, 0.6, 0.6, 0.6],
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 9 — Why It Works
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "Why Zero Data Loss?");
    addFooterBar(s);

    const items = [
      { text: "MongoDB Change Streams maintain a resume token \u2014 the source connector picks up exactly where it left off", icon: icons.dbDark },
      { text: "startup.mode=copy_existing re-copies all existing data on first connect or after offset loss", icon: icons.sync },
      { text: "Kafka\u2019s durable log retains messages for 7 days by default", icon: icons.arrowDark },
      { text: "Snowpipe provides exactly-once delivery semantics", icon: icons.cloudDark },
    ];

    items.forEach((item, i) => {
      const yBase = 1.35 + i * 0.95;
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 8.6, h: 0.8,
        fill: { color: C.white },
        shadow: cardShadow(),
      });
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 0.06, h: 0.8,
        fill: { color: C.green },
      });
      s.addImage({ data: item.icon, x: 1.0, y: yBase + 0.18, w: 0.4, h: 0.4 });
      s.addText(item.text, {
        x: 1.6, y: yBase, w: 7.5, h: 0.8,
        fontSize: 14, fontFace: "Calibri", color: C.bodyText,
        valign: "middle", margin: 0,
      });
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 10 — Failure Scenarios Matrix
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s);
    addHeader(s, "Resilience Across Failure Types");
    addFooterBar(s);

    const headerRow = [
      { text: "Failure", options: { fill: { color: C.navy }, color: C.white, bold: true, fontSize: 13, fontFace: "Trebuchet MS", align: "center", valign: "middle" } },
      { text: "Data Lost?", options: { fill: { color: C.navy }, color: C.white, bold: true, fontSize: 13, fontFace: "Trebuchet MS", align: "center", valign: "middle" } },
      { text: "Recovery", options: { fill: { color: C.navy }, color: C.white, bold: true, fontSize: 13, fontFace: "Trebuchet MS", align: "center", valign: "middle" } },
    ];

    const makeRow = (failure, lost, recovery, bg) => [
      { text: failure, options: { fill: { color: bg }, fontSize: 12, fontFace: "Calibri", color: C.darkText, bold: true, valign: "middle" } },
      { text: lost, options: { fill: { color: bg }, fontSize: 13, fontFace: "Calibri", color: C.green, bold: true, align: "center", valign: "middle" } },
      { text: recovery, options: { fill: { color: bg }, fontSize: 12, fontFace: "Calibri", color: C.bodyText, valign: "middle" } },
    ];

    const tableData = [
      headerRow,
      makeRow("Kafka broker down", "No", "Source connector retries until Kafka returns", C.white),
      makeRow("Snowflake unreachable", "No", "Sink connector retries; Kafka retains messages", C.lightGray),
      makeRow("Edge network drops", "No", "Source connector reconnects and resumes from last token", C.white),
      makeRow("MongoDB restarts", "No", "Change stream resumes from stored resume token", C.lightGray),
      makeRow("Full power outage", "No", "copy_existing re-syncs all data on restart", C.white),
    ];

    s.addTable(tableData, {
      x: 0.7, y: 1.4, w: 8.6,
      colW: [2.2, 1.2, 5.2],
      border: { pt: 0.5, color: "D0D5E0" },
      rowH: [0.5, 0.55, 0.55, 0.55, 0.55, 0.55],
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 11 — Summary
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s, true);

    s.addText("Key Takeaways", {
      x: 0.7, y: 0.4, w: 8.6, h: 0.6,
      fontSize: 30, fontFace: "Trebuchet MS", bold: true,
      color: C.white, margin: 0,
    });

    const takeaways = [
      { title: "Real-Time CDC Pipeline", desc: "MongoDB \u2192 Kafka \u2192 Snowflake in under 60 seconds", icon: icons.arrowDark },
      { title: "Zero Data Loss Proven", desc: "Data survives complete cloud-side outage", icon: icons.shield },
      { title: "Zero Cost POC", desc: "Built entirely on open-source + free trial", icon: icons.check },
    ];

    takeaways.forEach((item, i) => {
      const yBase = 1.4 + i * 1.2;
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 8.6, h: 1.0,
        fill: { color: C.navy },
        shadow: cardShadow(),
      });
      s.addShape("rectangle", {
        x: 0.7, y: yBase, w: 0.06, h: 1.0,
        fill: { color: C.accent },
      });
      s.addImage({ data: item.icon, x: 1.1, y: yBase + 0.25, w: 0.45, h: 0.45 });
      s.addText(item.title, {
        x: 1.8, y: yBase + 0.08, w: 7.2, h: 0.4,
        fontSize: 18, fontFace: "Trebuchet MS", bold: true,
        color: C.white, valign: "middle", margin: 0,
      });
      s.addText(item.desc, {
        x: 1.8, y: yBase + 0.5, w: 7.2, h: 0.35,
        fontSize: 14, fontFace: "Calibri",
        color: C.iceBlue, valign: "middle", margin: 0,
      });
    });
  }

  // ═══════════════════════════════════════
  // SLIDE 12 — Thank You
  // ═══════════════════════════════════════
  {
    const s = pres.addSlide();
    addSlideBg(s, true);

    // Top accent bar
    s.addShape("rectangle", {
      x: 0, y: 0, w: 10, h: 0.06,
      fill: { color: C.accent },
    });

    // Icons cluster (same as title slide)
    s.addImage({ data: icons.db, x: 3.6, y: 1.3, w: 0.5, h: 0.5 });
    s.addImage({ data: icons.arrow, x: 4.35, y: 1.38, w: 0.35, h: 0.35 });
    s.addImage({ data: icons.exchange, x: 4.95, y: 1.3, w: 0.5, h: 0.5 });
    s.addImage({ data: icons.arrow, x: 5.7, y: 1.38, w: 0.35, h: 0.35 });
    s.addImage({ data: icons.cloud, x: 6.3, y: 1.3, w: 0.5, h: 0.5 });

    s.addText("Thank You", {
      x: 0.7, y: 2.2, w: 8.6, h: 0.9,
      fontSize: 44, fontFace: "Trebuchet MS", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0,
    });

    s.addText("Questions?", {
      x: 0.7, y: 3.2, w: 8.6, h: 0.6,
      fontSize: 22, fontFace: "Calibri",
      color: C.iceBlue, align: "center", valign: "middle", margin: 0,
    });

    // Footer bar
    s.addShape("rectangle", {
      x: 0, y: 5.1, w: 10, h: 0.525,
      fill: { color: C.navy },
    });
  }

  // ── Save ──
  const outputPath = "C:\\Users\\rubar\\Development\\EXL_POC\\EXL_POC_Presentation.pptx";
  await pres.writeFile({ fileName: outputPath });
  console.log("Presentation saved to: " + outputPath);
}

main().catch(console.error);
