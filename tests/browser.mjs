// Transport fixtures only. These checks do not prove deployed SQL/RLS/Edge security.
// Start the current and legacy-fallback dev servers before running this transport fixture.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
require("./register-typescript.cjs");
const {
  parseLegacyKnowledgeFile,
  knowledgeDocumentPlainText,
} = require("../src/features/knowledge/editor/legacy-markdown.ts");
const { validateKnowledgeArticle } = require("../src/features/knowledge/editor/article-model.ts");
const { documents: seededDocuments } = require("./live-seed.cjs");
const documents = new Map(seededDocuments.map((d) => [d.id, d]));
const serverUrl = process.env.BF_TEST_SERVER_URL || "http://127.0.0.1:4175";
const legacyUrl = process.env.BF_TEST_LEGACY_URL || "http://127.0.0.1:4176";
const apiOrigin = "http://127.0.0.1:54329";
const results = [],
  pageErrors = [],
  consoleErrors = [],
  unexpectedNetwork = [];
const fixtureImage = fs.readFileSync("assets/icons/profile-avatar.png");
const photoFixture = fs.readFileSync("assets/brewery-cooper-bg.jpg");
let visualPhoto = false;
let uploadGate = null;
let listFailure = false,
  saveFailure = false,
  saveForbidden = false,
  invalidSaveResponse = false,
  mediaFailure = false,
  emptyPreview = false,
  signingFailure = false;
let saveCount = 0,
  uploadCount = 0;
const browser = await chromium.launch({
  executablePath: process.env.BF_TEST_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const check = async (name, run) => {
  if(process.env.BF_TEST_KNOWLEDGE_ONLY === "1" && !name.startsWith("Knowledge redesign:") && !name.startsWith("Knowledge cumulative:") && !name.startsWith("no JavaScript")) return;
  try {
    await run();
    results.push({ name, status: "passed" });
    console.log("PASS " + name);
  } catch (error) {
    results.push({
      name,
      status: "failed",
      error: error.stack || String(error),
    });
    console.error("FAIL " + name + " " + (error.stack || error));
    throw error;
  }
};
const visible = async (locator) => {
  await locator.waitFor({ state: "visible", timeout: 15000 });
};
const absent = async (locator) => {
  assert.equal(await locator.count(), 0);
};
async function addContent(page, name, position = "last") {
  const triggers = page.getByRole("button", { name: "Добавить", exact: true });
  await (position === "first" ? triggers.first() : triggers.last()).click();
  await page
    .getByRole("menu", { name: "Добавить", exact: true })
    .getByRole("menuitem", { name, exact: true })
    .click();
}
async function contentAction(page, index, action) {
  await page
    .getByRole("button", {
      name: `Действия с содержимым ${index}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("menu", { name: `Действия с содержимым ${index}`, exact: true })
    .getByRole("menuitem", { name: action, exact: true })
    .click();
}
async function textType(page, index, type) {
  await page
    .getByRole("button", { name: `Тип текста ${index}`, exact: true })
    .click();
  await page
    .getByRole("menu", { name: `Тип текста ${index}`, exact: true })
    .getByRole("menuitem", { name: type, exact: true })
    .click();
}
async function showParameters(page) {
  const details = page
    .locator("details")
    .filter({ has: page.locator("#article-description") });
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
}
async function showAlt(page) {
  const details = page
    .locator("details")
    .filter({ has: page.locator('input[id$="-alt"]') })
    .first();
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
}
async function articleAction(page, action) {
  await page
    .getByRole("button", { name: "Дополнительные действия", exact: true })
    .click();
  await page
    .getByRole("menu", { name: "Дополнительные действия", exact: true })
    .getByRole("menuitem", { name: action, exact: true })
    .click();
}

const sessions = [];
function profile(role = "admin", owner = false, active = true) {
  return {
    id: randomUUID(),
    first_name: "Тест",
    last_name: "Редактор",
    role,
    is_owner: owner,
    is_active: active,
    position_code: "manager",
    recovery_configured: true,
  };
}
async function session(
  p,
  { base = serverUrl, width = 390, height = 844, nativePopover = true } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "block",
  });
  if (!nativePopover)
    await context.addInitScript(() => {
      HTMLElement.prototype.showPopover = undefined;
      HTMLElement.prototype.hidePopover = undefined;
    });
  const state = {
    profile: p,
    profileFailure: false,
    contextFailure: false,
    grants: null,
    signCount: 0,
    reads: [],
    progress: new Set(),
  };
  sessions.push(state);
  const permissions = () => {
    const active = state.profile.is_active;
    const privileged =
      active && (state.profile.is_owner || state.profile.role === "admin");
    return {
      can_read: !!active,
      can_create: !!(active && (privileged || state.grants?.can_create)),
      can_edit: !!(active && (privileged || state.grants?.can_edit)),
      can_publish: !!(active && (privileged || state.grants?.can_publish)),
      can_manage_permissions: !!privileged,
    };
  };
  const canEdit = () => permissions().can_edit;
  const hasEditorAccess = () =>
    permissions().can_create || canEdit() || permissions().can_publish;
  const user = {
    id: p.id,
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const part = (object) =>
    Buffer.from(JSON.stringify(object)).toString("base64url");
  // Synthetic unsigned fixture; never sent to a real service.
  const token =
    part({ alg: "HS256", typ: "JWT" }) +
    "." +
    part({ sub: p.id, exp, aud: "authenticated" }) +
    ".fixture";
  await context.addInitScript(
    ({ authSession }) => {
      localStorage.setItem("sb-127-auth-token", JSON.stringify(authSession));
    },
    {
      authSession: {
        access_token: token,
        refresh_token: "fixture",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: exp,
        user,
      },
    },
  );
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if ([serverUrl, legacyUrl].includes(url.origin)) return route.continue();
    if (url.origin !== apiOrigin) {
      unexpectedNetwork.push(url.origin + url.pathname);
      return route.abort();
    }
    const pathname = url.pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    const denied = () => json({ code: "P0001", message: "forbidden" }, 403);
    if (pathname.endsWith("/staff-profile"))
      return state.profileFailure
        ? json({ error: "temporary_failure" }, 500)
        : json({ profile: state.profile });
    if (pathname === "/auth/v1/user") return json(user);
    if (pathname.startsWith("/auth/")) return json({});
    if (pathname.endsWith("/training_progress")) {
      if (request.method() === "POST") {
        state.progress.add(request.postDataJSON().article_id);
        return route.fulfill({ status: 201, body: "" });
      }
      return json(
        [...state.progress].map((article_id) => ({
          article_id,
          completed: true,
        })),
      );
    }
    if (
      /\/rest\/v1\/knowledge_(articles|article_blocks|article_media|editor_grants)/.test(
        pathname,
      )
    ) {
      unexpectedNetwork.push("direct Knowledge CRUD " + pathname);
      return denied();
    }
    if (pathname.includes("/rest/v1/rpc/")) {
      const rpc = pathname.split("/").pop(),
        body = request.postDataJSON() || {};
      state.reads.push(rpc);
      if (rpc === "get_knowledge_editor_context")
        return state.contextFailure
          ? json({ code: "XX000", message: "temporary_failure" }, 500)
          : json(permissions());
      if (rpc === "get_knowledge_articles")
        return listFailure
          ? json({ code: "XX000", message: "read_failed" }, 500)
          : json(
              [...documents.values()]
                .filter((d) => d.status === "published")
                .map((d) => ({
                  id: d.id,
                  title: d.title,
                  category: d.category,
                  description: d.description,
                  status: d.status,
                  revision: d.revision,
                  search_text: knowledgeDocumentPlainText(d),
                  first_image: (() => {
                    const b = d.blocks.find((b) => b.type === "image");
                    return b
                      ? {
                          mediaId: b.mediaId,
                          storagePath: b.storagePath,
                          legacySrc: b.legacySrc,
                          alt: b.alt,
                        }
                      : null;
                  })(),
                })),
            );
      if (rpc === "get_knowledge_editor_articles")
        return hasEditorAccess()
          ? json(
              [...documents.values()].map(
                ({ id, title, category, status, revision }) => ({
                  id,
                  title,
                  category,
                  status,
                  revision,
                }),
              ),
            )
          : denied();
      if (rpc === "get_knowledge_article") {
        const document = documents.get(body.p_article_id);
        if (!document)
          return json({ code: "P0001", message: "article_not_found" }, 404);
        if (document.status !== "published" && !hasEditorAccess())
          return denied();
        return json(document);
      }
      if (rpc === "save_knowledge_article") {
        saveCount++;
        const old = documents.get(body.p_document.id);
        const caps = permissions();
        if (
          !(old ? caps.can_edit : caps.can_create) ||
          saveForbidden ||
          ((old
            ? old.status !== body.p_document.status ||
              old.dashboard_featured !== body.p_document.dashboard_featured
            : body.p_document.status !== "draft" ||
              body.p_document.dashboard_featured) &&
            !caps.can_publish)
        )
          return denied();
        if (saveFailure)
          return json({ code: "XX000", message: "save_failed" }, 500);
        if (invalidSaveResponse)
          return json({ id: "wrong-id", revision: 999, status: "draft" });
        if ((old?.revision || 0) !== body.p_expected_revision)
          return json(
            { code: "P0001", message: "article_revision_conflict" },
            409,
          );
        const saved = {
          ...body.p_document,
          revision: (old?.revision || 0) + 1,
        };
        documents.set(saved.id, saved);
        return json({
          id: saved.id,
          revision: saved.revision,
          status: saved.status,
          created: !old,
          updated_at: new Date().toISOString(),
        });
      }
      if (rpc === "get_dashboard_upcoming_birthdays") return json([]);
      if (rpc === "get_position_shift_workflow")
        return json({
          context: {
            state: "available",
            position_code: "manager",
            venue_timezone: "Asia/Novosibirsk",
            server_now: new Date().toISOString(),
            can_manage_templates: true,
          },
          shift: null,
          rows: [],
          configured: false,
        });
      return json([]);
    }
    if (pathname.endsWith("/knowledge-media-upload")) {
      uploadCount++;
      if (uploadGate) { uploadGate.started(); await uploadGate.wait; }
      if (!canEdit() && !permissions().can_create) return denied();
      if (mediaFailure) return json({ ok: false, error: "upload_failed" }, 500);
      assert.match(
        request.headers()["content-type"],
        /^multipart\/form-data; boundary=/,
      );
      const id = randomUUID();
      return json({
        ok: true,
        media: {
          id,
          storage_path: "fixture/" + id + (visualPhoto ? ".jpg" : ".png"),
          mime_type: visualPhoto ? "image/jpeg" : "image/png",
          byte_size: visualPhoto ? photoFixture.length : fixtureImage.length,
          width: visualPhoto ? 1600 : 72,
          height: visualPhoto ? 1066 : 72,
          original_name: visualPhoto ? "brewery-cooper-bg.jpg" : "fixture.png",
        },
        signed_url: emptyPreview
          ? ""
          : apiOrigin +
            "/storage/v1/object/sign/knowledge-media/fixture/" +
            id +
            ".png",
      });
    }
    if (
      pathname === "/storage/v1/object/sign/knowledge-media" &&
      request.method() === "POST"
    ) {
      state.signCount++;
      return mediaFailure || signingFailure
        ? json({ error: "unavailable" }, 500)
        : json(
            request.postDataJSON().paths.map((path) => ({
              path,
              error: null,
              signedURL:
                "/object/sign/knowledge-media/" + path + "?token=fixture",
            })),
          );
    }
    if (pathname.startsWith("/storage/v1/object/"))
      return route.fulfill({
        contentType: visualPhoto ? "image/jpeg" : "image/png",
        body: visualPhoto ? photoFixture : fixtureImage,
      });
    if (pathname.startsWith("/recipes/")) return json({ recipes: [] });
    return json([]);
  });
  await context.routeWebSocket(/^ws:\/\/127\.0\.0\.1:54329\//, (socket) => {
    socket.onMessage((message) => {
      const packet = JSON.parse(String(message));
      if (Array.isArray(packet))
        socket.send(
          JSON.stringify([
            packet[0],
            packet[1],
            packet[2],
            "phx_reply",
            { status: "ok", response: { postgres_changes: [] } },
          ]),
        );
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/^Failed to load resource:/.test(message.text())
    )
      consoleErrors.push(message.text());
  });
  let navigation = 0;
  const open = async (path) => {
    // Force a document load when testing entry URLs, not an untracked manual hash POP.
    await page.goto(base + "/?bf-test-entry=" + ++navigation + "#" + path);
    await visible(page.locator("main"));
  };
  return { context, page, state, open, base };
}
let owner, reader, senior, admin;
try {
  await check("native Owner entry, list and editor deep link", async () => {
    owner = await session(profile("staff", true));
    await owner.open("/knowledge");
    await visible(
      owner.page.getByRole("link", { name: "Новая статья", exact: true }),
    );
    assert.equal(await owner.page.locator(".knowledge-list-row").count(), 26);
    await owner.page
      .getByRole("link", { name: "Новая статья", exact: true })
      .click();
    await visible(owner.page.getByLabel("Заголовок", { exact: true }));
  });
  await check(
    "required title prevents RPC and keeps editor content",
    async () => {
      await owner.page
        .getByRole("button", { name: "Действия с содержимым 1", exact: true })
        .click();
      assert.ok(
        await owner.page
          .getByRole("menuitem", { name: "Удалить", exact: true })
          .isDisabled(),
      );
      await owner.page.keyboard.press("Escape");
      const count = saveCount;
      await owner.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(owner.page.getByRole("alert"));
      assert.equal(saveCount, count);
      await owner.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Интеграция — тестовая статья");
      await owner.page
        .getByLabel("Текст 1", { exact: true })
        .fill(
          "Уникальныйтестконтента 🍺 безопасный текст <script>alert(1)</script>",
        );
    },
  );
  await check(
    "bold/italic/highlight formatting and preview escape HTML",
    async () => {
      const text = owner.page.getByLabel("Текст 1", { exact: true });
      for (const label of ["Жирный", "Курсив", "Выделение"]) {
        await text.evaluate((el) => {
          el.focus();
          el.setSelectionRange(0, 25);
          el.dispatchEvent(new Event("select", { bubbles: true }));
        });
        await owner.page
          .getByRole("button", { name: label, exact: true })
          .first()
          .click();
      }
      await owner.page
        .getByRole("button", { name: "Предпросмотр", exact: true })
        .click();
      assert.ok(
        await owner.page
          .locator(
            ".knowledge-prose strong em mark, .knowledge-prose mark em strong",
          )
          .count(),
      );
      assert.equal(
        await owner.page.locator(".knowledge-prose script").count(),
        0,
      );
      await owner.page
        .getByRole("button", { name: "Редактор", exact: true })
        .click();
    },
  );
  await check(
    "image format/signature rejection does not invoke upload",
    async () => {
      const count = uploadCount;
      await addContent(owner.page, "Фото");
      await owner.page.locator("input[type=file]").setInputFiles({
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("<svg>bad</svg>"),
      });
      await visible(owner.page.getByRole("alert"));
      assert.equal(uploadCount, count);
    },
  );
  await check("image between blocks, alt/caption, move, replace", async () => {
    await addContent(owner.page, "Фото");
    await owner.page.locator("input[type=file]").setInputFiles({
      name: "fixture.png",
      mimeType: "image/png",
      buffer: fixtureImage,
    });
    await showAlt(owner.page);
    await visible(
      owner.page.getByLabel("Описание для экранных дикторов", { exact: true }),
    );
    await owner.page
      .getByLabel("Описание для экранных дикторов", { exact: true })
      .fill("Тестовый рисунок");
    await owner.page
      .getByLabel("Подпись", { exact: true })
      .fill("Подпись изображения");
    await addContent(owner.page, "Текст");
    await owner.page
      .getByLabel("Текст 3", { exact: true })
      .fill("Абзац после изображения");
    await contentAction(owner.page, 2, "Переместить выше");
    assert.ok(
      await owner.page
        .getByRole("region", { name: "Содержимое 1", exact: true })
        .getByLabel("Описание для экранных дикторов")
        .count(),
    );
    await contentAction(owner.page, 1, "Переместить ниже");
    await owner.page
      .getByRole("button", { name: "Заменить фото", exact: true })
      .click();
    await owner.page.locator("input[type=file]").setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: fixtureImage,
    });
    await visible(
      owner.page.getByRole("button", { name: "Сохранить", exact: true }),
    );
    await owner.page.waitForFunction(
      () => !document.querySelector("fieldset").disabled,
    );
    assert.equal(
      await owner.page
        .getByLabel("Описание для экранных дикторов", { exact: true })
        .inputValue(),
      "Тестовый рисунок",
    );
  });
  await check("headings/callout, ordered list and separator", async () => {
    await textType(owner.page, 3, "Подзаголовок");
    await addContent(owner.page, "Текст");
    await textType(owner.page, 4, "Заметка");
    await owner.page.getByLabel("Текст 4", { exact: true }).fill("Примечание");
    await addContent(owner.page, "Список");
    await owner.page
      .getByLabel("Вид списка", { exact: true })
      .selectOption("ordered");
    await owner.page
      .getByLabel("Пункт 1", { exact: true })
      .fill("Первый пункт");
    await owner.page
      .getByRole("button", { name: "Добавить пункт", exact: true })
      .click();
    await owner.page
      .getByLabel("Пункт 2", { exact: true })
      .fill("Второй пункт");
    await addContent(owner.page, "Разделитель");
  });
  await check(
    "unsaved hash navigation is blocked; Escape keeps draft",
    async () => {
      await owner.page
        .getByRole("link", { name: "Знания", exact: true })
        .first()
        .click();
      await visible(
        owner.page.getByRole("dialog", { name: "Покинуть редактор?" }),
      );
      await owner.page.keyboard.press("Escape");
      assert.equal(
        await owner.page.getByLabel("Заголовок", { exact: true }).inputValue(),
        "Интеграция — тестовая статья",
      );
    },
  );
  await check(
    "keyboard skip link focuses content without changing the editor hash",
    async () => {
      await owner.page.locator("dialog").waitFor({ state: "hidden" });
      const url = owner.page.url();
      await owner.page.locator(".bf-skip-link").focus();
      await owner.page.keyboard.press("Enter");
      assert.equal(owner.page.url(), url);
      assert.equal(
        await owner.page.evaluate(() => document.activeElement.id),
        "mainContent",
      );
    },
  );
  await check("browser Back is blocked while a draft is dirty", async () => {
    await owner.page.evaluate(() => history.back());
    await visible(
      owner.page.getByRole("dialog", { name: "Покинуть редактор?" }),
    );
    await owner.page
      .getByRole("button", { name: "Остаться", exact: true })
      .click();
    assert.equal(
      await owner.page.getByLabel("Заголовок", { exact: true }).inputValue(),
      "Интеграция — тестовая статья",
    );
  });
  await check(
    "draft saves to RPC, survives reload, and is rediscoverable",
    async () => {
      await owner.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        owner.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      const d = [...documents.values()].find(
        (d) => d.title === "Интеграция — тестовая статья",
      );
      assert.ok(d);
      owner.documentId = d.id;
      await owner.open("/knowledge/manage");
      await visible(
        owner.page.getByRole("heading", { name: d.title, exact: true }),
      );
      await owner.open("/knowledge/" + encodeURIComponent(d.id) + "/edit");
      await visible(owner.page.getByLabel("Заголовок", { exact: true }));
      assert.equal(
        await owner.page.getByLabel("Заголовок", { exact: true }).inputValue(),
        d.title,
      );
      assert.ok(d.blocks[0].content.marks.length === 3);
      assert.equal(d.blocks[1].type, "image");
      assert.equal(d.blocks[4].ordered, true);
    },
  );
  await check("publish/read/progress and signed image lightbox", async () => {
    await owner.page
      .getByLabel("Статус", { exact: true })
      .selectOption("published");
    await owner.page
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await visible(
      owner.page.getByText("Статья сохранена на сервере.", { exact: true }),
    );
    await articleAction(owner.page, "Открыть статью");
    await visible(
      owner.page.getByRole("button", {
        name: "Открыть изображение: Тестовый рисунок",
        exact: true,
      }),
    );
    await owner.page
      .getByRole("button", {
        name: "Открыть изображение: Тестовый рисунок",
        exact: true,
      })
      .click();
    await visible(owner.page.getByRole("dialog"));
    await owner.page.keyboard.press("Escape");
    await owner.page
      .getByRole("button", { name: "Отметить прочитанным", exact: true })
      .click();
    await visible(
      owner.page.getByRole("button", { name: "Прочитано ✓", exact: true }),
    );
    assert.ok(owner.state.progress.has(owner.documentId));
  });
  await check(
    "independent Staff session reads publication and finds content search",
    async () => {
      reader = await session(profile("staff"));
      await reader.open("/knowledge");
      await visible(
        reader.page.getByLabel("Поиск по базе знаний", { exact: true }),
      );
      await reader.page
        .getByLabel("Поиск по базе знаний", { exact: true })
        .fill("Уникальныйтестконтента");
      await visible(
        reader.page.getByRole("link", {
          name: "Открыть статью Интеграция — тестовая статья",
          exact: true,
        }),
      );
      await absent(
        reader.page.getByRole("link", { name: "Новая статья", exact: true }),
      );
      await reader.page
        .getByRole("link", {
          name: "Открыть статью Интеграция — тестовая статья",
          exact: true,
        })
        .click();
      await visible(
        reader.page.getByText("Подпись изображения", { exact: true }),
      );
      await absent(
        reader.page.getByRole("link", {
          name: "Редактировать статью",
          exact: true,
        }),
      );
    },
  );
  await check(
    "Dashboard reading cards and global search use published server source",
    async () => {
      await reader.open("/");
      await visible(
        reader.page.getByRole("heading", { name: "Что почитать", exact: true }),
      );
      await reader.page
        .locator("#dashboard-global-search")
        .fill("Уникальныйтестконтента");
      await visible(
        reader.page
          .locator('[aria-label="Быстрый поиск по порталу"]')
          .getByRole("link")
          .filter({ hasText: "Интеграция — тестовая статья" }),
      );
      assert.ok(await reader.page.locator('a[href*="/knowledge/"]').count());
    },
  );
  await check(
    "Senior working manager and Staff direct editor URLs remain denied",
    async () => {
      await reader.open(
        "/knowledge/" + encodeURIComponent(owner.documentId) + "/edit",
      );
      await visible(reader.page.getByRole("alert"));
      await absent(reader.page.getByLabel("Заголовок", { exact: true }));
      senior = await session(profile("senior"));
      await senior.open("/knowledge/new");
      await visible(senior.page.getByRole("alert"));
      await absent(senior.page.getByLabel("Заголовок", { exact: true }));
    },
  );
  await check(
    "Admin can edit; two editors get revision conflict without draft loss",
    async () => {
      admin = await session(profile("admin"), { width: 1440, height: 900 });
      await admin.open(
        "/knowledge/" + encodeURIComponent(owner.documentId) + "/edit",
      );
      await visible(admin.page.getByLabel("Заголовок", { exact: true }));
      await owner.open(
        "/knowledge/" + encodeURIComponent(owner.documentId) + "/edit",
      );
      await visible(owner.page.getByLabel("Заголовок", { exact: true }));
      await showParameters(admin.page);
      await admin.page
        .getByLabel("Краткое описание", { exact: true })
        .fill("Версия администратора");
      await admin.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        admin.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      await showParameters(owner.page);
      await owner.page
        .getByLabel("Краткое описание", { exact: true })
        .fill("Несохранённая версия владельца");
      await owner.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(owner.page.getByRole("alert"));
      assert.match(
        await owner.page.getByRole("alert").innerText(),
        /Другой редактор|верс|изменен/i,
      );
      assert.equal(
        await owner.page
          .getByLabel("Краткое описание", { exact: true })
          .inputValue(),
        "Несохранённая версия владельца",
      );
      assert.equal(
        documents.get(owner.documentId).description,
        "Версия администратора",
      );
      const download = owner.page.waitForEvent("download");
      await owner.page
        .getByRole("button", { name: "Скачать копию", exact: true })
        .click();
      await download;
    },
  );
  await check(
    "conflict recovery reloads server version after explicit discard",
    async () => {
      owner.page.once("dialog", (dialog) => dialog.accept());
      await owner.page
        .getByRole("button", {
          name: "Загрузить серверную версию",
          exact: true,
        })
        .click();
      await owner.page.waitForFunction(
        () =>
          document.querySelector("textarea")?.value === "Версия администратора",
      );
    },
  );
  await check(
    "network save failure preserves changes and never reports success",
    async () => {
      saveFailure = true;
      await showParameters(owner.page);
      await owner.page
        .getByLabel("Краткое описание", { exact: true })
        .fill("Сеть недоступна — сохранить текст");
      await owner.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(owner.page.getByRole("alert"));
      assert.equal(
        await owner.page
          .getByLabel("Краткое описание", { exact: true })
          .inputValue(),
        "Сеть недоступна — сохранить текст",
      );
      await absent(
        owner.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      saveFailure = false;
    },
  );
  await check(
    "malformed save response is not mistaken for success",
    async () => {
      invalidSaveResponse = true;
      await owner.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(owner.page.getByRole("alert"));
      await absent(
        owner.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      invalidSaveResponse = false;
    },
  );
  await check(
    "server mutation denial overrides stale editor access",
    async () => {
      saveForbidden = true;
      await owner.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(owner.page.getByRole("alert"));
      assert.match(
        await owner.page.getByRole("alert").innerText(),
        /доступ|прав/i,
      );
      saveForbidden = false;
    },
  );
  await check(
    "failed media upload leaves original blocks and metadata unchanged",
    async () => {
      const count = await owner.page.locator("[data-block-id]").count();
      mediaFailure = true;
      await owner.page
        .getByRole("button", { name: "Заменить фото", exact: true })
        .click();
      await owner.page.locator("input[type=file]").setInputFiles({
        name: "fixture.png",
        mimeType: "image/png",
        buffer: fixtureImage,
      });
      await visible(owner.page.getByRole("alert"));
      assert.equal(await owner.page.locator("[data-block-id]").count(), count);
      assert.equal(
        await owner.page.getByLabel("Подпись", { exact: true }).inputValue(),
        "Подпись изображения",
      );
      ((mediaFailure = false),
        (emptyPreview = false),
        (signingFailure = false));
    },
  );
  await check(
    "390px editor has no horizontal overflow; inputs are 16px or larger",
    async () => {
      assert.ok(
        await owner.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const sizes = await owner.page
        .locator('input:not([hidden]):not([type="checkbox"]),textarea,select')
        .evaluateAll((items) =>
          items.map((el) => parseFloat(getComputedStyle(el).fontSize)),
        );
      assert.ok(sizes.every((size) => size >= 16));
      await owner.page.screenshot({
        path: "reports/editor-error-mobile.png",
        fullPage: true,
      });
      await admin.page.screenshot({
        path: "reports/editor-error-desktop.png",
        fullPage: true,
      });
    },
  );
  await check(
    "articles and images are not persisted in localStorage/IndexedDB",
    async () => {
      for (const target of [owner, reader, admin]) {
        const state = await target.page.evaluate(async () => ({
          values: Object.entries(localStorage)
            .filter(([key]) => !key.endsWith("-auth-token"))
            .map(([, value]) => value),
          dbs: await indexedDB.databases(),
        }));
        assert.ok(
          state.values.every(
            (value) =>
              !value.includes("Уникальныйтестконтента") &&
              !value.includes("blocks") &&
              !value.includes("storagePath"),
          ),
        );
        assert.equal(state.dbs.length, 0);
      }
    },
  );
  await check(
    "supabase reader error is explicit and never falls back to legacy",
    async () => {
      listFailure = true;
      await reader.open("/knowledge");
      await visible(
        reader.page.getByText("Материалы сейчас недоступны", { exact: true }),
      );
      assert.equal(await reader.page.locator(".knowledge-list-row").count(), 0);
      listFailure = false;
      await reader.page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await visible(reader.page.locator(".knowledge-list-row").first());
    },
  );
  await check(
    "archive is hidden from Staff and retained in editor index",
    async () => {
      await admin.page
        .getByLabel("Статус", { exact: true })
        .selectOption("archived");
      await admin.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        admin.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      await reader.open("/knowledge/" + encodeURIComponent(owner.documentId));
      await visible(
        reader.page.getByRole("heading", {
          name: "Статья не найдена",
          exact: true,
        }),
      );
      await admin.open("/knowledge/manage");
      await visible(
        admin.page.getByRole("heading", {
          name: "Интеграция — тестовая статья",
          exact: true,
        }),
      );
    },
  );
  await check(
    "legacy source preserves 26 rows, old deep links and query/category back state",
    async () => {
      const legacyReader = await session(profile("staff"), { base: legacyUrl });
      await legacyReader.open("/knowledge?q=херес&cat=Алкоголь");
      await visible(legacyReader.page.locator(".knowledge-list-row").first());
      await legacyReader.page.locator(".knowledge-list-row").first().click();
      await visible(
        legacyReader.page.getByRole("button", {
          name: "Отметить прочитанным",
          exact: true,
        }),
      );
      await legacyReader.page
        .getByRole("link", { name: "Знания", exact: true })
        .first()
        .click();
      assert.match(legacyReader.page.url(), /q=.*cat=/);
      await legacyReader.open("/article/lesson-1");
      await visible(
        legacyReader.page.getByRole("button", {
          name: "Отметить прочитанным",
          exact: true,
        }),
      );
      assert.match(legacyReader.page.url(), /#\/knowledge\/lesson-1/);
      await legacyReader.open("/training");
      await visible(legacyReader.page.locator(".knowledge-list-row").first());
      assert.equal(
        await legacyReader.page.locator(".knowledge-list-row").count(),
        26,
      );
      await legacyReader.context.close();
    },
  );
  await check(
    "profile hotfix keeps Senior capabilities after transient resume error",
    async () => {
      const target = await session(profile("senior"), { base: legacyUrl });
      await target.open("/shift");
      await visible(
        target.page.getByRole("link", {
          name: "Редактор чек-листов",
          exact: true,
        }),
      );
      target.state.profileFailure = true;
      await target.page.evaluate(() =>
        window.dispatchEvent(new Event("focus")),
      );
      await target.page.waitForTimeout(300);
      await visible(
        target.page.getByRole("link", {
          name: "Редактор чек-листов",
          exact: true,
        }),
      );
      target.state.profileFailure = false;
      target.state.profile.role = "staff";
      await target.page.evaluate(() =>
        window.dispatchEvent(new Event("online")),
      );
      await target.page.waitForTimeout(300);
      await absent(
        target.page.getByRole("link", {
          name: "Редактор чек-листов",
          exact: true,
        }),
      );
      await target.context.close();
    },
  );
  await check(
    "all 26 supplied seed articles reopen via lesson IDs, with 12 legacy captions and progress",
    async () => {
      const target = await session(profile("staff"));
      let images = 0;
      for (const d of seededDocuments) {
        await target.open("/knowledge/" + d.id);
        await visible(
          target.page.getByRole("heading", { name: d.title, exact: true }),
        );
        await visible(
          target.page.getByRole("button", {
            name: "Отметить прочитанным",
            exact: true,
          }),
        );
        const expected = d.blocks.filter((b) => b.type === "image");
        // The summary heading/read action render before the separate detail RPC.
        // Wait for content rather than treating the summary as article readiness.
        await visible(target.page.locator(".knowledge-prose"));
        assert.equal(
          await target.page.locator(".knowledge-prose figcaption").count(),
          expected.length,
        );
        for (const b of expected)
          assert.ok(
            (
              await target.page.locator(".knowledge-prose").innerText()
            ).includes(b.alt),
          );
        images += expected.length;
        // Seed description is an excerpt; it must not create an extra paragraph in the body.
        assert.equal(
          await target.page.locator(".knowledge-prose > p").count(),
          d.blocks.filter((b) => b.type === "paragraph").length,
        );
      }
      assert.equal(images, 12);
      await target.page
        .getByRole("button", { name: "Отметить прочитанным", exact: true })
        .click();
      await visible(
        target.page.getByRole("button", { name: "Прочитано ✓", exact: true }),
      );
      assert.ok(target.state.progress.has("lesson-27"));
      await target.context.close();
    },
  );
  await check(
    "future create-only grant creates draft and cannot edit existing or publish",
    async () => {
      const target = await session(profile("staff"));
      target.state.grants = {
        can_create: true,
        can_edit: false,
        can_publish: false,
      };
      await target.open("/knowledge");
      await visible(
        target.page.getByRole("link", { name: "Новая статья", exact: true }),
      );
      await target.page
        .getByRole("link", { name: "Новая статья", exact: true })
        .click();
      await visible(target.page.getByLabel("Заголовок", { exact: true }));
      assert.ok(
        await target.page.getByLabel("Статус", { exact: true }).isDisabled(),
      );
      await target.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Создано с отдельным разрешением");
      await target.page
        .getByLabel("Текст 1", { exact: true })
        .fill("Создание черновика");
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(target.page.getByRole("alert"));
      const saved = [...documents.values()].find(
        (d) => d.title === "Создано с отдельным разрешением",
      );
      assert.equal(saved.status, "draft");
      assert.equal(saved.revision, 1);
      await target.open("/knowledge/lesson-1/edit");
      await visible(target.page.getByRole("alert"));
      await absent(target.page.getByLabel("Заголовок", { exact: true }));
      await target.context.close();
    },
  );
  await check(
    "future edit-only grant edits published text without allowing create/status change; fresh revoke retains draft",
    async () => {
      const target = await session(profile("senior"));
      target.state.grants = {
        can_create: false,
        can_edit: true,
        can_publish: false,
      };
      await target.open("/knowledge");
      await visible(
        target.page.getByRole("link", {
          name: "Управление статьями",
          exact: true,
        }),
      );
      await absent(
        target.page.getByRole("link", { name: "Новая статья", exact: true }),
      );
      await target.open("/knowledge/lesson-1/edit");
      await visible(target.page.getByLabel("Заголовок", { exact: true }));
      assert.ok(
        await target.page.getByLabel("Статус", { exact: true }).isDisabled(),
      );
      await showParameters(target.page);
      await target.page
        .getByLabel("Краткое описание", { exact: true })
        .fill("Отредактировано по отдельному разрешению");
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      assert.equal(documents.get("lesson-1").status, "published");
      await showParameters(target.page);
      await target.page
        .getByLabel("Краткое описание", { exact: true })
        .fill("Текст при отзыве прав");
      target.state.grants = null;
      const count = saveCount;
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(target.page.getByRole("alert"));
      assert.equal(saveCount, count);
      assert.equal(
        await target.page
          .getByLabel("Краткое описание", { exact: true })
          .inputValue(),
        "Текст при отзыве прав",
      );
      await target.page.evaluate(() =>
        window.dispatchEvent(new Event("online")),
      );
      await visible(
        target.page.getByRole("button", {
          name: "Скачать несохранённую копию",
          exact: true,
        }),
      );
      await target.context.close();
    },
  );
  await check(
    "Edge success without signed URL plus signing outage preserves uploaded block across save/reopen",
    async () => {
      const target = await session(profile("admin"));
      await target.open("/knowledge/new");
      await visible(target.page.getByLabel("Заголовок", { exact: true }));
      await target.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Картинка без preview URL");
      emptyPreview = true;
      signingFailure = true;
      await addContent(target.page, "Фото");
      await target.page.locator("input[type=file]").setInputFiles({
        name: "fixture.png",
        mimeType: "image/png",
        buffer: fixtureImage,
      });
      await showAlt(target.page);
      await visible(
        target.page.getByLabel("Описание для экранных дикторов", {
          exact: true,
        }),
      );
      await target.page
        .getByLabel("Описание для экранных дикторов", { exact: true })
        .fill("Alt при ошибке предпросмотра");
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      const saved = [...documents.values()].find(
        (d) => d.title === "Картинка без preview URL",
      );
      assert.ok(saved.blocks[1].mediaId);
      assert.equal(saved.blocks[1].legacySrc, null);
      emptyPreview = false;
      signingFailure = false;
      await target.open("/knowledge/" + saved.id + "/edit");
      await showAlt(target.page);
      await visible(
        target.page.getByLabel("Описание для экранных дикторов", {
          exact: true,
        }),
      );
      assert.equal(
        await target.page
          .getByLabel("Описание для экранных дикторов", { exact: true })
          .inputValue(),
        "Alt при ошибке предпросмотра",
      );
      await visible(target.page.locator("fieldset img"));
      const count = target.state.signCount;
      await target.page.evaluate(() =>
        window.dispatchEvent(new Event("online")),
      );
      await target.page.waitForFunction(
        () => document.querySelector("fieldset img")?.complete,
      );
      await target.page.waitForTimeout(150);
      assert.ok(target.state.signCount > count);
      await target.context.close();
    },
  );
  await check(
    "UX: text-only draft saves/reopens without technical labels or always-visible advanced fields",
    async () => {
      const target = await session(profile("admin"));
      await target.open("/knowledge/new");
      await visible(target.page.getByLabel("Заголовок", { exact: true }));
      await target.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Статья только из текста");
      await target.page
        .getByLabel("Текст 1", { exact: true })
        .fill("Простой текст для коллег. Фото можно добавить позже.");
      assert.doesNotMatch(
        await target.page.locator("main").innerText(),
        /блок|schema|revision|level|Версия \d|Ссылка на редактор/iu,
      );
      assert.equal(
        await target.page
          .getByText("Выделите часть текста, затем выберите формат.", {
            exact: true,
          })
          .count(),
        1,
      );
      assert.ok(
        !(await target.page
          .getByLabel("Краткое описание", { exact: true })
          .isVisible()),
      );
      assert.equal(
        await target.page
          .getByRole("button", { name: "Скачать копию", exact: true })
          .count(),
        0,
      );
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      const saved = [...documents.values()].find(
        (d) => d.title === "Статья только из текста",
      );
      assert.equal(saved.status, "draft");
      assert.equal(saved.blocks.length, 1);
      assert.equal(saved.blocks[0].type, "paragraph");
      await target.open("/knowledge/" + saved.id + "/edit");
      await visible(target.page.getByLabel("Текст 1", { exact: true }));
      assert.equal(
        await target.page.getByLabel("Текст 1", { exact: true }).inputValue(),
        saved.blocks[0].content.text,
      );
      const download = target.page.waitForEvent("download");
      await articleAction(target.page, "Скачать копию");
      await download;
      await target.context.close();
    },
  );
  await check(
    "UX: keyboard menu opening/arrows/Escape/light-dismiss; disabled boundaries and 44px targets",
    async () => {
      const target = await session(profile("admin"));
      await target.open("/knowledge/new");
      await visible(target.page.getByLabel("Текст 1", { exact: true }));
      const trigger = target.page
        .getByRole("button", { name: "Добавить", exact: true })
        .last();
      await trigger.focus();
      await target.page.keyboard.press("Enter");
      const menu = target.page.getByRole("menu", {
        name: "Добавить",
        exact: true,
      });
      await visible(menu);
      assert.equal(
        await target.page.evaluate(() =>
          document.activeElement.textContent.trim(),
        ),
        "Текст",
      );
      await target.page.keyboard.press("ArrowDown");
      assert.equal(
        await target.page.evaluate(() =>
          document.activeElement.textContent.trim(),
        ),
        "Фото",
      );
      await target.page.keyboard.press("Home");
      assert.equal(await target.page.evaluate(()=>document.activeElement.textContent.trim()),"Текст");
      await target.page.keyboard.press("End");
      assert.equal(await target.page.evaluate(()=>document.activeElement.textContent.trim()),"Разделитель");
      await target.page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      assert.ok(await trigger.evaluate((el) => el === document.activeElement));
      await trigger.click();
      await visible(menu);
      await target.page
        .getByRole("heading", { name: "Новая статья", exact: true })
        .click();
      await menu.waitFor({ state: "hidden" });
      const type = target.page.getByRole("button", {
        name: "Тип текста 1",
        exact: true,
      });
      await type.focus();
      await target.page.keyboard.press("ArrowDown");
      await target.page.keyboard.press("ArrowDown");
      await target.page.keyboard.press("Enter");
      assert.ok(
        await target.page
          .getByLabel("Текст 1", { exact: true })
          .evaluate((el) => el.classList.contains("bf-editor-heading")),
      );
      await textType(target.page, 1, "Обычный текст");
      await target.page
        .getByRole("button", { name: "Действия с содержимым 1", exact: true })
        .click();
      for (const name of ["Переместить выше", "Переместить ниже", "Удалить"])
        assert.ok(
          await target.page
            .getByRole("menuitem", { name, exact: true })
            .isDisabled(),
        );
      await target.page.keyboard.press("Escape");
      const sizes = await target.page
        .locator(
          ".bf-article-editor button:visible,.bf-article-editor summary:visible,.bf-article-editor select:visible",
        )
        .evaluateAll((elements) =>
          elements.map((el) => el.getBoundingClientRect().height),
        );
      assert.ok(sizes.every((size) => size >= 44));
      await target.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Клавиатура");
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      await target.context.close();
    },
  );
  await check(
    "UX: text/photo/text clean mobile 390px and desktop screenshots from built preview",
    async () => {
      visualPhoto = true;
      const target = await session(profile("admin"));
      await target.open("/knowledge/new");
      await visible(target.page.getByLabel("Заголовок", { exact: true }));
      await target.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Как рассказывать о нашем пиве");
      await target.page.getByLabel("Категория", { exact: true }).fill("Пиво");
      await target.page
        .getByLabel("Текст 1", { exact: true })
        .fill(
          "Начните с вкуса: мягкий солод, свежий аромат и приятная горчинка. Помогите гостю выбрать то, что ему понравится.",
        );
      await addContent(target.page, "Фото");
      await target.page.locator("input[type=file]").setInputFiles({
        name: "brewery-cooper-bg.jpg",
        mimeType: "image/jpeg",
        buffer: photoFixture,
      });
      await visible(target.page.getByLabel("Подпись", { exact: true }));
      assert.ok(
        !(await target.page
          .getByLabel("Описание для экранных дикторов", { exact: true })
          .isVisible()),
      );
      await target.page
        .getByLabel("Подпись", { exact: true })
        .fill("Здесь рождается наше пиво");
      await showAlt(target.page);
      await target.page
        .getByLabel("Описание для экранных дикторов", { exact: true })
        .fill("Медные ёмкости в пивоварне BeerFactory");
      await target.page
        .locator("details")
        .filter({ has: target.page.locator('input[id$="-alt"]') })
        .locator("summary")
        .click();
      await addContent(target.page, "Текст");
      await target.page
        .getByLabel("Текст 3", { exact: true })
        .fill(
          "Если гость сомневается, предложите попробовать. Расскажите, с каким блюдом пиво будет особенно хорошо сочетаться.",
        );
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      const saved = [...documents.values()].find(
        (d) => d.title === "Как рассказывать о нашем пиве",
      );
      assert.deepEqual(
        saved.blocks.map((b) => b.type),
        ["paragraph", "image", "paragraph"],
      );
      await target.open("/knowledge/" + saved.id + "/edit");
      await visible(target.page.getByLabel("Текст 3", { exact: true }));
      await target.page.locator("fieldset img").evaluate((img) => img.decode());
      assert.doesNotMatch(
        await target.page.locator("main").innerText(),
        /блок|schema|revision|level/iu,
      );
      assert.ok(
        await target.page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const mobileHeight = await target.page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await target.page.setViewportSize({ width: 390, height: mobileHeight });
      await target.page.screenshot({
        path: "reports/editor-mobile.png",
        fullPage: true,
      });
      await target.page.setViewportSize({ width: 1366, height: 900 });
      const desktopHeight = await target.page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await target.page.setViewportSize({ width: 1366, height: desktopHeight });
      await target.page.screenshot({
        path: "reports/editor-desktop.png",
        fullPage: true,
      });
      await showAlt(target.page);
      assert.equal(
        await target.page
          .getByLabel("Описание для экранных дикторов", { exact: true })
          .inputValue(),
        saved.blocks[1].alt,
      );
      await addContent(target.page, "Подзаголовок");
      await target.page
        .getByLabel("Текст 4", { exact: true })
        .fill("Сочетания с блюдами");
      await textType(target.page, 4, "Вложенный подзаголовок");
      await addContent(target.page, "Заметка");
      await target.page
        .getByLabel("Текст 5", { exact: true })
        .fill("Предлагайте выбор без давления.");
      await addContent(target.page, "Список");
      await target.page
        .getByLabel("Вид списка", { exact: true })
        .selectOption("unordered");
      await target.page
        .getByLabel("Пункт 1", { exact: true })
        .fill("Свежий вкус 🍺");
      assert.equal(
        await target.page
          .getByRole("region", { name: "Содержимое 6", exact: true })
          .getByRole("button", { name: "Жирный", exact: true })
          .count(),
        0,
      );
      await target.page
        .getByRole("button", { name: "Формат: Пункт 1", exact: true })
        .click();
      await target.page
        .getByLabel("Пункт 1", { exact: true })
        .evaluate((el) => {
          el.focus();
          el.setSelectionRange(7, el.value.length);
          el.dispatchEvent(new Event("select", { bubbles: true }));
        });
      await target.page
        .getByRole("region", { name: "Содержимое 6", exact: true })
        .getByRole("button", { name: "Жирный", exact: true })
        .click();
      await target.page
        .getByRole("button", { name: "Добавить пункт", exact: true })
        .click();
      await target.page
        .getByLabel("Пункт 2", { exact: true })
        .fill("Рекомендация к блюду");
      await target.page
        .getByRole("button", { name: "Удалить пункт 2", exact: true })
        .click();
      await addContent(target.page, "Разделитель");
      const count = await target.page.locator("[data-block-id]").count();
      target.page.once("dialog", (dialog) => dialog.accept());
      await contentAction(target.page, 7, "Удалить");
      assert.equal(
        await target.page.locator("[data-block-id]").count(),
        count - 1,
      );
      await addContent(target.page, "Разделитель");
      await contentAction(target.page, 4, "Переместить выше");
      await contentAction(target.page, 3, "Переместить ниже");
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      const advanced = documents.get(saved.id);
      assert.equal(advanced.blocks[3].level, 3);
      assert.equal(advanced.blocks[4].type, "quote");
      assert.equal(advanced.blocks[5].ordered, false);
      assert.ok(advanced.blocks[5].items[0].marks.length);
      assert.equal(advanced.blocks[6].type, "separator");
      await target.open("/knowledge/" + saved.id + "/edit");
      await visible(target.page.getByLabel("Пункт 1", { exact: true }));
      assert.ok(
        await target.page
          .getByLabel("Текст 4", { exact: true })
          .evaluate((el) => el.classList.contains("bf-editor-subheading")),
      );
      await target.page
        .getByRole("button", { name: "Предпросмотр", exact: true })
        .click();
      assert.ok(await target.page.locator(".knowledge-prose h3").count());
      assert.ok(
        await target.page
          .locator(".knowledge-prose .knowledge-callout")
          .count(),
      );
      assert.ok(
        await target.page.locator(".knowledge-prose ul strong").count(),
      );
      assert.ok(await target.page.locator(".knowledge-prose hr").count());
      await target.context.close();
      visualPhoto = false;
    },
  );
  await check(
    "UX: fallback without Popover API supports add/type/Tab/Escape/toggle and preserves text",
    async () => {
      const target = await session(profile("admin"), { nativePopover: false });
      await target.open("/knowledge/new");
      await visible(target.page.getByLabel("Текст 1", { exact: true }));
      const trigger = target.page
        .getByRole("button", { name: "Добавить", exact: true })
        .last();
      await trigger.click();
      await visible(
        target.page.getByRole("menu", { name: "Добавить", exact: true }),
      );
      await target.page.keyboard.press("Tab");
      await target.page
        .getByRole("menu", { name: "Добавить", exact: true })
        .waitFor({ state: "hidden" });
      assert.ok(
        await target.page.evaluate(
          () => document.activeElement.offsetParent !== null,
        ),
      );
      await trigger.click();
      await visible(
        target.page.getByRole("menu", { name: "Добавить", exact: true }),
      );
      await trigger.focus();
      await target.page.keyboard.press("Enter");
      await target.page
        .getByRole("menu", { name: "Добавить", exact: true })
        .waitFor({ state: "hidden" });
      await target.page
        .getByLabel("Заголовок", { exact: true })
        .fill("Fallback меню");
      await target.page
        .getByLabel("Текст 1", { exact: true })
        .fill("Исходный текст");
      await addContent(target.page, "Текст");
      await target.page
        .getByLabel("Текст 2", { exact: true })
        .fill("Следующий текст");
      await textType(target.page, 2, "Подзаголовок");
      assert.equal(
        await target.page.getByLabel("Текст 2", { exact: true }).inputValue(),
        "Следующий текст",
      );
      await target.page
        .getByRole("button", { name: "Тип текста 2", exact: true })
        .click();
      await target.page.keyboard.press("Escape");
      await target.page
        .getByRole("menu", { name: "Тип текста 2", exact: true })
        .waitFor({ state: "hidden" });
      await target.page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await visible(
        target.page.getByText("Статья сохранена на сервере.", { exact: true }),
      );
      await target.context.close();
    },
  );
  await check("Knowledge redesign: two mobile sticker columns, real categories/search/read count and desktop screenshot", async () => {
    // Earlier editor/grant regressions mutate transport fixtures. Reset only this
    // in-memory fixture map so visual captures compare the supplied seed content.
    documents.clear();
    for (const document of seededDocuments) documents.set(document.id,structuredClone(document));
    const target = await session(profile("staff"));
    await target.open("/knowledge");
    await visible(target.page.locator(".knowledge-sticker").first());
    for(const width of [320,390,430,768,1366]) {
      await target.page.setViewportSize({width,height:844});
      const layout = await target.page.locator(".knowledge-sticker-grid").evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns.split(" ").length,width:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.equal(layout.columns,2); assert.ok(layout.width <= layout.viewport+1);
      const first = await target.page.locator(".knowledge-sticker").nth(0).boundingBox(), second = await target.page.locator(".knowledge-sticker").nth(1).boundingBox();
      assert.ok(Math.abs(first.y-second.y)<8); assert.ok(second.x>first.x+first.width-4);
    }
    await target.page.setViewportSize({width:390,height:844});
    await target.page.evaluate(()=>document.fonts.ready);
    await target.page.evaluate(()=>window.scrollTo(0,0));
    await target.page.screenshot({path:"reports/knowledge-list-mobile.png"});
    await target.page.setViewportSize({width:1366,height:1000});
    await target.page.evaluate(()=>window.scrollTo(0,0));
    await target.page.screenshot({path:"reports/knowledge-list-desktop.png"});
    const categories = target.page.getByRole("group",{name:"Категории базы знаний"});
    await categories.getByRole("button",{name:"Пиво",exact:true}).click();
    assert.equal(await categories.getByRole("button",{name:"Пиво",exact:true}).getAttribute("aria-pressed"),"true");
    assert.match(target.page.url(),/cat=/);
    await visible(target.page.getByRole("heading",{name:"Как появилось пиво",exact:true}));
    assert.equal(await target.page.locator(".knowledge-sticker").count(),1);
    await target.page.getByLabel("Поиск по базе знаний").fill("неттакойстатьи");
    await visible(target.page.getByRole("heading",{name:"Ничего не найдено",exact:true}));
    await target.page.getByLabel("Поиск по базе знаний").fill("");
    await target.page.locator(".knowledge-sticker").first().click();
    await visible(target.page.getByRole("button",{name:"Отметить прочитанным",exact:true}));
    await target.page.getByRole("button",{name:"Отметить прочитанным",exact:true}).click();
    await visible(target.page.getByRole("button",{name:"Прочитано ✓",exact:true}));
    await target.page.getByRole("link",{name:"Знания",exact:true}).first().click();
    assert.match(target.page.url(),/cat=/);
    await visible(target.page.locator(".knowledge-read-check"));
    assert.ok(target.state.progress.has("lesson-6"));
    await target.context.close();
  });
  await check("Knowledge redesign: notebook all schema-v2 elements, signed photo viewer, keyboard close and real build screenshots",async()=>{
    // Synthetic transport document only; no production or seed data is modified.
    const id="knowledge-visual-fixture";
    const text=t=>({text:t,marks:[]});
    documents.set(id,validateKnowledgeArticle({...seededDocuments[0],id,title:"Как правильно наливать пиво",category:"Пиво",description:"Стандарты подачи и температура",status:"published",revision:1,blocks:[
      {id:"visual-p1",type:"paragraph",content:text("Правильная подача пива — это не только про вкус, но и про впечатление гостя. Мы уделяем особое внимание стандартам, ведь каждая деталь имеет значение.")},
      {id:"visual-photo",type:"image",mediaId:randomUUID(),storagePath:"fixture/knowledge-photo.jpg",legacySrc:null,name:"brewery-cooper-bg.jpg",alt:"Медные пивоваренные ёмкости BeerFactory",caption:"Внимание к деталям начинается на пивоварне.",width:1600,height:1066},
      {id:"visual-heading",type:"heading",level:2,content:text("Температура и бокал")},
      {id:"visual-p2",type:"paragraph",content:{text:"Используем чистые бокалы. Проверяем подачу и рассказываем гостю о сорте.",marks:[{type:"bold",from:0,to:10},{type:"italic",from:11,to:17},{type:"highlight",from:25,to:34}]}},
      {id:"visual-quote",type:"quote",content:text("Пена должна быть плотной и кремовой — 2–3 см.")},
      {id:"visual-h3",type:"heading",level:3,content:text("Перед подачей")},
      {id:"visual-list",type:"list",ordered:false,items:[text("Проверьте чистоту бокала"),text("Уточните предпочтения гостя")]},
      {id:"visual-ordered",type:"list",ordered:true,items:[text("Подготовьте бокал"),text("Подайте напиток")]},
      {id:"visual-hr",type:"separator"}
    ]}));
    const target=await session(profile("staff")); visualPhoto=true;
    try {
      await target.open("/knowledge/"+id);
      await visible(target.page.locator(".knowledge-image-button img"));
      await target.page.locator(".knowledge-image-button img").evaluate(img=>img.decode());
      await target.page.evaluate(()=>document.fonts.ready);
      assert.equal(await target.page.locator(".knowledge-prose h2").count(),1);
      assert.equal(await target.page.locator(".knowledge-prose h3").count(),1);
      assert.equal(await target.page.locator(".knowledge-prose aside").count(),1);
      assert.equal(await target.page.locator(".knowledge-prose ul").count(),1);
      assert.equal(await target.page.locator(".knowledge-prose ol").count(),1);
      assert.equal(await target.page.locator(".knowledge-prose hr").count(),1);
      for(const tag of ["strong","em","mark"]) assert.equal(await target.page.locator(".knowledge-prose "+tag).count(),1);
      for(const width of [320,390,430,768,1366]) {
        await target.page.setViewportSize({width,height:844});
        assert.ok(await target.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        const style=await target.page.locator(".knowledge-prose").evaluate(el=>({font:getComputedStyle(el).fontSize,color:getComputedStyle(el).color}));
        assert.equal(style.font,"16px"); assert.equal(style.color,"rgb(53, 55, 55)");
      }
      await target.page.setViewportSize({width:390,height:844});
      await target.page.screenshot({path:"reports/knowledge-article-mobile.png"});
      const photo=target.page.getByRole("button",{name:"Открыть изображение: Медные пивоваренные ёмкости BeerFactory",exact:true});
      await photo.focus(); await target.page.keyboard.press("Enter");
      await visible(target.page.getByRole("dialog"));
      const opened=await target.page.getByRole("dialog").locator("img").boundingBox();
      assert.ok(opened.width>280);
      await target.page.getByRole("dialog").locator("img").evaluate(img=>img.decode());
      await target.page.waitForTimeout(250); // Let the existing 180ms modal entrance finish.
      await target.page.screenshot({path:"reports/knowledge-image-viewer-mobile.png"});
      await target.page.getByRole("button",{name:"Закрыть изображение",exact:true}).click();
      await absent(target.page.getByRole("dialog"));
      await photo.click(); await visible(target.page.getByRole("dialog"));
      await target.page.keyboard.press("Escape"); await absent(target.page.getByRole("dialog"));
      assert.equal(await photo.evaluate(el=>el===document.activeElement),true);
      await target.page.setViewportSize({width:1366,height:1000});
      await target.page.evaluate(()=>window.scrollTo(0,0));
      await target.page.screenshot({path:"reports/knowledge-article-desktop.png"});
      await photo.click(); await visible(target.page.getByRole("dialog"));
      await target.page.keyboard.press("Escape"); await absent(target.page.getByRole("dialog"));
    } finally { visualPhoto=false; documents.delete(id); await target.context.close(); }
  });
  await check("Knowledge redesign: legacy images still enlarge, same notebook, long article no mobile overflow",async()=>{
    const target=await session(profile("staff"),{base:legacyUrl});
    await target.open("/knowledge/lesson-17");
    const photo=target.page.locator(".knowledge-image-button").first();
    await visible(photo); await photo.click(); await visible(target.page.getByRole("dialog"));
    await target.page.getByRole("button",{name:"Закрыть изображение",exact:true}).click();
    await absent(target.page.getByRole("dialog"));
    await target.page.evaluate(()=>document.fonts.ready);
    await target.page.screenshot({path:"reports/knowledge-legacy-article-mobile.png"});
    for(const id of ["lesson-1","lesson-11","lesson-14","lesson-24"]) {
      await target.open("/knowledge/"+id);
      await visible(target.page.locator(".knowledge-prose"));
      assert.ok(await target.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await target.page.getByRole("button",{name:"Отметить прочитанным",exact:true}).scrollIntoViewIfNeeded();
      const safe=await target.page.getByRole("button",{name:"Отметить прочитанным",exact:true}).boundingBox();
      const nav=await target.page.getByRole("navigation",{name:"Основная навигация"}).boundingBox();
      assert.ok(safe.y+safe.height<=nav.y+1);
    }
    await target.context.close();
  });
  await check("Knowledge redesign: keyboard focus, long title, reduced motion, paper contrast and 44px controls",async()=>{
    const target=await session(profile("staff"));
    await target.open("/knowledge"); await visible(target.page.locator(".knowledge-sticker").first());
    await target.page.emulateMedia({reducedMotion:"reduce"});
    assert.ok(await target.page.locator(".knowledge-sticker").first().evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<=.001));
    const entry=target.page.locator(".knowledge-sticker").first(); await entry.focus();
    assert.ok(await entry.evaluate(el=>getComputedStyle(el).outlineStyle!=="none"));
    await target.page.keyboard.press("Enter"); await visible(target.page.locator(".knowledge-notebook-heading h1"));
    await target.page.getByRole("link",{name:"Знания",exact:true}).first().focus(); await target.page.keyboard.press("Enter");
    await visible(target.page.locator(".knowledge-sticker").first());
    const sizes=await target.page.locator('.knowledge-brand-actions :is(a,button),.knowledge-board-categories button,.knowledge-board-search input,.knowledge-board-summary a').evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
    assert.ok(sizes.every(s=>s.h>=44&&s.w>=44));
    await target.page.getByLabel("Поиск по базе знаний").fill("Шампанским");
    const title=target.page.locator(".knowledge-sticker h2").first(); await visible(title);
    assert.ok((await title.innerText()).includes("Шампанским"));
    assert.ok(await title.evaluate(el=>el.clientHeight<=80&&el.clientWidth>100));
    // Equivalent viewport at 200% desktop browser zoom; horizontal overflow must not appear.
    await target.page.setViewportSize({width:683,height:500});
    assert.ok(await target.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await target.context.close();
  });
  await check("Knowledge redesign: production PWA precaches local font and textures for offline use",async()=>{
    const context=await browser.newContext({serviceWorkers:"allow",viewport:{width:390,height:844}});
    context.on("console", message=>{if(message.type()==="error") consoleErrors.push("PWA: "+message.text());});
    context.on("weberror", error=>pageErrors.push(String(error.error())));
    await context.route("**/*",route=> new URL(route.request().url()).origin===serverUrl ? route.continue() : route.abort());
    const page=await context.newPage();
    page.on("pageerror",error=>pageErrors.push(String(error)));
    await page.goto(serverUrl);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.reload();
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cacheInfo=await page.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,keys:(await Promise.all((await caches.keys()).map(async key=>(await (await caches.open(key)).keys()).map(r=>r.url)))).flat()}));
    fs.writeFileSync("reports/knowledge-pwa-cache.json",JSON.stringify(cacheInfo,null,2)+"\n");
    await context.unroute("**/*"); // Routing disables the HTTP cache; leave real SW fetch handling intact.
    await context.setOffline(true);
    const cached=await page.evaluate(async()=>{
      const result=[];
      for(const path of ["caveat-cyrillic.woff","paper-grain.svg","leather-grain.svg"]) {
        const response=await fetch("/assets/knowledge/"+path);
        result.push({path,status:response.status,bytes:(await response.arrayBuffer()).byteLength});
      }
      await document.fonts.load('600 30px "BF Journal"',"Знания");
      return result;
    });
    assert.ok(cached.every(r=>r.status===200&&r.bytes>100));
    fs.writeFileSync("reports/knowledge-pwa-offline.json",JSON.stringify(cached,null,2)+"\n");
    await context.setOffline(false);
    await context.close();
  });
  await check("Knowledge cumulative: three mobile sticker rows and varied thematic icons without removing controls", async () => {
    const target = await session(profile("staff"));
    try {
      await target.open("/knowledge");
      await visible(target.page.locator(".knowledge-sticker").first());
      await target.page.evaluate(() => document.fonts.ready);
      const metrics = await target.page.evaluate(() => {
        const cards = [...document.querySelectorAll(".knowledge-sticker")].slice(0,6);
        return {
          viewport: {width:innerWidth,height:innerHeight},
          cards: cards.map(el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}; }),
          navbar: document.querySelector('nav[aria-label="Основная навигация"]').getBoundingClientRect().top,
          icons: cards.map(el => el.querySelector(".knowledge-sticker-icons > svg").getAttribute("class")),
          titleSize: getComputedStyle(cards[0].querySelector("h2")).fontSize,
          excerptSize: getComputedStyle(cards[0].querySelector(".knowledge-excerpt")).fontSize,
        };
      });
      assert.equal(metrics.viewport.width,390);
      assert.equal(metrics.cards.length,6);
      assert.ok(metrics.cards.every(r => r.bottom <= metrics.navbar + 2),JSON.stringify(metrics));
      assert.ok(new Set(metrics.icons).size >= 3,JSON.stringify(metrics.icons));
      assert.equal(metrics.titleSize,"14px");
      assert.equal(metrics.excerptSize,"12px");
      await visible(target.page.getByLabel("Поиск по базе знаний"));
      await visible(target.page.getByRole("group",{name:"Категории базы знаний"}));
      await visible(target.page.locator(".knowledge-board-summary"));
      await visible(target.page.getByRole("link",{name:/Аттестация/}));
      fs.writeFileSync("reports/knowledge-mobile-density.json",JSON.stringify(metrics,null,2)+"\n");
      await target.page.screenshot({path:"reports/knowledge-list-mobile.png"});
    } finally { await target.context.close(); }
  });
  await check("Knowledge cumulative: consecutive photos use deterministic width alignment tilt and every image opens viewer",async()=>{
    const id="knowledge-photo-mount-fixture";
    const captions=["Первое фото — реальная подпись.","Второе фото — другая подпись.","Третье фото — заметка.","Четвёртое фото — подпись."];
    documents.set(id,validateKnowledgeArticle({...seededDocuments[0],id,title:"Фотографии пивоварни",status:"published",revision:1,blocks:captions.map((caption,i)=>({id:"mount-"+i,type:"image",mediaId:randomUUID(),storagePath:"fixture/mount-"+i+".jpg",legacySrc:null,name:"photo.jpg",alt:"Ёмкости пивоварни "+(i+1),caption,width:1600,height:1066}))}));
    const target=await session(profile("staff")); visualPhoto=true;
    try {
      await target.open("/knowledge/"+id);
      await visible(target.page.locator(".knowledge-image-button img").first());
      await target.page.locator(".knowledge-image-button img").evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
      await target.page.evaluate(()=>document.fonts.ready);
      const layouts=[];
      for(const width of [320,390,430,1366]) {
        await target.page.setViewportSize({width,height:844});
        assert.ok(await target.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        const metrics=await target.page.locator(".knowledge-figure").evaluateAll(figures=>figures.map(el=>({width:el.offsetWidth,parentWidth:el.parentElement.clientWidth,left:el.offsetLeft,transform:getComputedStyle(el).transform,caption:el.querySelector("figcaption").textContent})));
        assert.deepEqual(metrics.map(m=>m.caption),captions);
        assert.equal(new Set(metrics.map(m=>m.transform)).size,4);
        assert.ok(new Set(metrics.map(m=>m.left)).size>=3);
        if(width<640) for(const [i,expected] of [.90,.86,.82,.92].entries()) assert.ok(Math.abs(metrics[i].width/metrics[i].parentWidth-expected)<.015,JSON.stringify(metrics));
        layouts.push({viewport:width,figures:metrics});
      }
      await target.page.setViewportSize({width:390,height:844});
      await target.page.evaluate(()=>window.scrollTo(0,0));
      await target.page.screenshot({path:"reports/knowledge-photo-mounts-mobile.png",fullPage:true});
      for(let i=0;i<4;i++) {
        await target.page.locator(".knowledge-image-button").nth(i).click();
        await visible(target.page.getByRole("dialog"));
        assert.equal(await target.page.getByRole("dialog").locator("img").getAttribute("alt"),"Ёмкости пивоварни "+(i+1));
        await target.page.keyboard.press("Escape");
        await absent(target.page.getByRole("dialog"));
      }
      fs.writeFileSync("reports/knowledge-photo-mounts.json",JSON.stringify(layouts,null,2)+"\n");
    } finally { visualPhoto=false; documents.delete(id); await target.context.close(); }
  });
  await check("Knowledge cumulative: accessible nonblocking upload indicator success and network recovery preserve entered content",async()=>{
    const target=await session(profile("admin"));
    let release=()=>{};
    const hold=()=>{ let started; const arrived=new Promise(resolve=>{started=resolve;}); const wait=new Promise(resolve=>{release=resolve;}); uploadGate={started,wait}; return arrived; };
    try {
      await target.open("/knowledge/new");
      await visible(target.page.getByLabel("Заголовок",{exact:true}));
      await target.page.getByLabel("Заголовок",{exact:true}).fill("Проверка загрузки фото");
      await target.page.getByLabel("Текст 1",{exact:true}).fill("Введённый текст остаётся на экране.");
      await addContent(target.page,"Фото");
      const count=uploadCount;
      let arrived=hold();
      await target.page.locator("input[type=file]").setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:fixtureImage});
      await arrived;
      const status=target.page.locator(".bf-editor-upload-status");
      await visible(status);
      assert.equal(await status.getAttribute("role"),"status");
      assert.equal(await status.getAttribute("aria-live"),"polite");
      assert.equal(await status.getAttribute("aria-atomic"),"true");
      assert.match(await status.innerText(),/Загружаем изображение…/);
      assert.match(await status.innerText(),/Не закрывайте страницу/);
      assert.ok(await status.evaluate(el=>getComputedStyle(el).pointerEvents==="none"&&!el.contains(document.activeElement)&&!el.contains(document.elementFromPoint(innerWidth/2,innerHeight/2))));
      const rect=await target.page.locator(".bf-editor-upload-status-card").boundingBox();
      assert.ok(Math.abs(rect.x+rect.width/2-195)<2);
      assert.ok(Math.abs(rect.y+rect.height/2-422)<2);
      assert.ok(await target.page.getByRole("button",{name:"Подождите…",exact:true}).isDisabled());
      await target.page.screenshot({path:"reports/editor-upload-indicator-mobile.png"});
      release(); uploadGate=null;
      await status.waitFor({state:"hidden"});
      await visible(target.page.getByLabel("Подпись",{exact:true}));
      assert.equal(uploadCount,count+1);
      await target.page.getByLabel("Подпись",{exact:true}).fill("Сохранённая подпись");
      await target.page.getByRole("button",{name:"Заменить фото",exact:true}).click();
      mediaFailure=true; arrived=hold();
      await target.page.locator("input[type=file]").setInputFiles({name:"retry.png",mimeType:"image/png",buffer:fixtureImage});
      await arrived; await visible(status);
      release(); uploadGate=null;
      await status.waitFor({state:"hidden"});
      await visible(target.page.getByRole("alert"));
      assert.equal(await target.page.getByLabel("Текст 1",{exact:true}).inputValue(),"Введённый текст остаётся на экране.");
      assert.equal(await target.page.getByLabel("Подпись",{exact:true}).inputValue(),"Сохранённая подпись");
      await visible(target.page.getByRole("button",{name:"Скачать копию",exact:true}));
      assert.equal(uploadCount,count+2);
      assert.ok(!(await target.page.getByRole("button",{name:"Сохранить",exact:true}).isDisabled()));
    } finally { release(); uploadGate=null; mediaFailure=false; await target.context.close(); }
  });
  await check("no JavaScript errors or external/live requests", async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(unexpectedNetwork, []);
  });
} catch (error) {
  if (owner)
    await owner.page
      .screenshot({ path: "reports/browser-failure.png", fullPage: true })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  // Avoid a Chromium/Playwright race between a dirty page's beforeunload dialog
  // and closing the CDP session. This is test teardown, not production behavior.
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .evaluate(() =>
          window.addEventListener(
            "beforeunload",
            (event) => event.stopImmediatePropagation(),
            { capture: true },
          ),
        )
        .catch(() => {});
      page.on("dialog", (dialog) => {
        void dialog.dismiss().catch(() => {});
      });
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(
    "reports/browser-results.json",
    JSON.stringify(
      {
        scope:
          "Playwright with transport fixtures; NO live SQL/RLS/Edge validation",
        browser: await browser.version(),
        results,
        pageErrors,
        consoleErrors,
        unexpectedNetwork,
        saveRequests: saveCount,
        uploadRequests: uploadCount,
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
}
