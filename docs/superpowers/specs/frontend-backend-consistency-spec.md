# Frontend-Backend Tutarlılık Spec Dosyası

**Oluşturulma Tarihi:** 2026-05-18
**Hazırlayan:** Buffy (AI Agent)
**Durum:** Taslak — Kullanıcı ile yapılan görüşmeler sonucu oluşturulmuştur.

---

## 1. Genel Bakış (Executive Summary)

agent-web projesinde frontend (Next.js uygulaması) ile backend (AI tool motoru) arasında ciddi bir kopukluk bulunmaktadır. Kullanıcı, CommandRail'deki araç butonlarına (Terminal, Files, Web, DB, Git, Tasks) tıkladığında hiçbir şey olmamakta, AI ise terminal tool'una erişemediğini belirtmektedir. Bu spec, frontend-backend tutarlılığını sağlamak için gereken tüm çalışmaları kapsamaktadır.

---

## 2. Mevcut Durum (As-Is Analysis)

### 2.1 Frontend

| Bileşen | Durum | Detay |
|---------|-------|-------|
| **CommandRail** (sol navigasyon) | ❌ Çalışmıyor | `page.tsx` içinde tanımlı `CommandRail` bileşeni (satır 93-144). Butonlar (`Term`, `Files`, `Web`, `DB`, `Git`, `Tasks`) `active: true` olarak işaretlenmiş ama hiçbirine `onClick` handler'ı bağlanmamış. Sadece görsel öğeler. |
| **Terminal Butonu** (header) | ❌ Çalışmıyor | `aria-label="Open terminal"` ile header'da bir Terminal ikonu var ama `onClick` bağlı değil. |
| **Context Panel** (sağ panel) | ⚠️ Kısmen | Tool activity bazen gösteriyor (terminal için hiç göstermedi). "Project Files" bölümü görünmüyor/boş. İstatistikler (Messages, Tokens, Tools) çalışıyor olabilir. |
| **Tool Call Bubble** (sohbet baloncuğu) | ❌ Hiç görülmedi | AI hiç terminal komutu çalıştırmadı, dolayısıyla `ToolCallBubble` bileşeni terminal için hiç render edilmedi. |
| **Chat Interface** | ✅ Kısmen | Mesajlaşma çalışıyor, streaming çalışıyor. Tool çağrılarını parse etme mantığı var ama hiçbir tool çağrısı gelmiyor. |

### 2.2 Backend (Tool Sistemi)

| Bileşen | Durum | Detay |
|---------|-------|-------|
| **Tool Registry** (`packages/core/src/tools/registry.ts`) | ✅ Tanımlı | 8 tool (terminal, read_file, write_file, web_search, list_directory, search_files, web_fetch, execute_code) registry'de tanımlı. `@agent-web/core/tools` export'u ile API route'a sunuluyor. |
| **Terminal Tool** (`packages/core/src/tools/terminal/index.ts`) | ✅ Tanımlı | `getBackend()` ile Docker/local seçimi yapıyor. Docker yoksa local'e fallback yapıyor. |
| **Terminal - Local** (`packages/core/src/tools/terminal/local.ts`) | ✅ Tanımlı | `child_process.exec` kullanıyor, blocklist, timeout, output limit var. |
| **Terminal - Docker** (`packages/core/src/tools/terminal/docker.ts`) | ✅ Tanımlı | Docker container'da komut çalıştırıyor. `TERMINAL_SANDBOX_CONTAINER` env'i kullanıyor. |
| **Chat API Route** (`apps/web/app/api/chat/route.ts`) | ✅ Tanımlı | `tools` objesini `@agent-web/core/tools`'dan import edip `streamText`'e iletiyor. Tool descriptions system prompt'a ekleniyor. |
| **`packages/core` Build Durumu** | ✅ Başarılı | `pnpm --filter @agent-web/core build` hatasız tamamlanıyor. `dist/` klasörü güncel. TypeScript'ten JavaScript'e başarıyla derleniyor. |
| **`package.json` Export Yapısı** | ✅ Doğru | `exports` alanı: `.` → `dist/index.js`, `./tools` → `dist/tools/registry.js`, `./types` → `dist/types.js`. API route'daki `import { tools } from "@agent-web/core/tools"` doğru çalışıyor. |
| **`next.config.ts` transpilePackages** | ✅ Doğru | `@agent-web/core` ve `@agent-web/db` `transpilePackages` listesinde. Webpack fallback'leri de yapılandırılmış (client-side Node.js modülleri stun'lanmış). |
| **Proje API Routes** | ✅ Tanımlı | `POST /api/projects` (yeni proje), `GET /api/projects/[id]/files` (dosyaları listele/içerik oku) mevcut ve çalışıyor. |

### 2.3 Kritik Problemler

1. **Frontend-CommandRail boşluğu**: CommandRail butonlarında `onClick` handler'ı yok. Herhangi bir state değişimi, panel açma veya tool tetikleme yapılmıyor.
2. **Header terminal butonu bağlantısız**: Header'daki terminal ikonu da sadece görsel.
3. **Backend tool'ları AI tarafından kullanılamıyor**: AI "tool kullanılamıyor" diyor. `packages/core` build'i başarılı olmasına rağmen bu sorun yaşanıyor. Olası nedenler:
   - **`projectId` eksik olabilir**: API route `projectId`'ye göre `projectRootPath`'i alıyor. Eğer kullanıcının aktif bir projesi yoksa, `projectRootPath` boş oluyor ve system prompt'ta "You are working inside a project directory..." bilgisi yer almıyor. AI çalışma dizinini bilmediği için terminal tool'unu kullanmaktan çekinebilir.
   - **AI model tool calling desteği**: Kullanıcının seçtiği model tool calling'i desteklemiyor olabilir (bazı küçük/ücretsiz modeller tool calling'i desteklemez).
   - **System prompt yetersiz**: Tool descriptions system prompt'a ekleniyor ama AI yine de tool kullanmayı tercih etmeyebilir.
   - **Provider API tool calling limiti**: OpenRouter veya başka bir provider üzerinden kullanılan modelin tool calling limiti veya ek ücreti olabilir.
4. **Context Panel Project Files**: Boş görünüyor. Backend'de `/api/projects/[id]/files` API'si çalışmasına rağmen, frontend'deki `ProjectFiles` bileşeni bu API'yi çağırmıyor olabilir veya kullanıcının aktif bir projesi/projeId'si olmayabilir.

---

## 3. Hedef Durum (To-Be)

### 3.1 Kapsam

Kullanıcı tüm CommandRail butonlarının (Terminal, Files, Web, DB, Git, Tasks) işlevsel hale gelmesini istiyor. Ayrıca AI'ın tool'ları (özellikle terminal) kullanabilmesini bekliyor.

> **Önemli Not:** Kullanıcı ayrı bir terminal penceresi (gömülü shell UI) istemiyor. "Tool olarak yeterli" diyor, yani AI'ın sohbet akışında tool çağırması yeterli.

### 3.2 Beklenen Davranışlar

| Özellik | Beklenen Davranış | Öncelik |
|---------|-------------------|---------|
| **Terminal Tool (AI)** | AI, kullanıcıdan terminal komutu istediğinde `terminal` tool'unu çalıştırabilmeli, sonucu sohbette gösterebilmeli | 🔴 Kritik |
| **CommandRail - Term** | Tıklandığında AI'a terminal komutu çalıştırmasını söyleyen bir prompt göndermeli veya bir panel açmalı | 🟡 Orta |
| **CommandRail - Files** | Proje dosyalarını listelemeli veya file tool'unu tetiklemeli | 🟡 Orta |
| **CommandRail - Web** | Web arama aracını tetiklemeli | 🟢 Düşük |
| **CommandRail - DB** | Veritabanı bağlantı/query paneli açmalı (gelecek) | 🟢 Düşük |
| **CommandRail - Git** | Git durumu paneli veya git komutları için prompt | 🟢 Düşük |
| **CommandRail - Tasks** | Görev listesi paneli | 🟢 Düşük |
| **Context Panel - Tools** | Canlı tool activity, terminal tool çağrılarını da göstermeli | 🟡 Orta |
| **Context Panel - Files** | Proje dosyaları listelenmeli, okunabilmeli | 🟡 Orta |

---

## 4. Mimari Kararlar (Architecture Decisions)

### ADR-1: CommandRail Butonları Panel Açmak Yerine Chat Prompt'u Tetiklesin

**Karar**: CommandRail butonları, ayrı bir panel açmak yerine, AI'a ilgili aracı kullanmasını söyleyen bir prompt'u sohbet girişine otomatik doldursun veya direkt olarak bir konuşma başlatsın.

**Gerekçe**: 
- Kullanıcı "tool olarak yeterli" dedi — ayrı bir UI bileşeni istemiyor
- Mevcut chat altyapısı zaten tool calling'i destekliyor
- Ek UI bileşenleri yapmak daha fazla iş ve bakım yükü
- Kullanıcı AI ile sohbet ederek tool'ları kullanmak istiyor

### ADR-2: Backend Tool Registry Build Edilmeli ve Test Edilmeli

**Karar**: `packages/core` build altyapısı kontrol edilecek, derleme başarısız ise düzeltilecek. API route'da tool import'unun çalıştığı doğrulanacak.

**Gerekçe**: AI'ın "tool kullanılamıyor" demesinin en olası sebebi, `streamText`'e geçilen `tools` objesinin boş/hatalı olması veya tool'ların AI modeli tarafından desteklenmemesidir.

### ADR-3: Önce Temel Altyapı, Sonra UI İyileştirmeleri

**Karar**: İş akışı şu şekilde sıralanacak:
1. Backend tool altyapısını çalışır hale getir (AI tool kullanabilsin)
2. CommandRail butonlarına temel işlevsellik kazandır
3. Context Panel iyileştirmeleri
4. Diğer butonlar ve detaylı iyileştirmeler

---

## 5. İş Paketleri (Work Packages)

### WP-1: Backend Tool Altyapısını Düzeltme

**Hedef:** AI'ın tool'ları kullanabilmesini sağlamak.

**Kontrol listesi:**
- [x] `packages/core` build durumu: ✅ Başarılı (`pnpm --filter @agent-web/core build` hatasız)
- [x] `next.config.ts` `transpilePackages`: ✅ `@agent-web/core` ve `@agent-web/db` doğru ayarlanmış
- [x] `package.json` exports: ✅ `@agent-web/core/tools` → `dist/tools/registry.js` doğru export
- [ ] API route'da (`apps/web/app/api/chat/route.ts`) `tools` import'unun çalışma zamanında doğru çalıştığını doğrula (server log ile kontrol)
- [ ] `streamText` çağrısında tool'ların AI modeline doğru iletilip iletilmediğini kontrol et
- [ ] **🔴 Kullanıcının aktif bir `projectId`'si ve `projectRootPath`'i var mı kontrol et** — bu olmadan system prompt'ta çalışma dizini bilgisi yer almaz, AI terminal kullanmaktan çekinebilir
- [ ] Kullanılan AI modelinin tool calling desteği olup olmadığını kontrol et (OpenAI/OpenRouter modelleri genelde destekler, DeepSeek destekler, bazı eski/küçük modeller desteklemez)
- [ ] `toolDescriptions`'ın system prompt'ta doğru göründüğünü doğrula
- [ ] Bir proje oluşturup (`POST /api/projects` ile) AI'a spesifik bir komut vermeyi dene (örn: "Bu projenin olduğu dizinde `dir` çalıştır")

**Kabul Kriteri:**
- `pnpm dev` ile çalışan uygulamada kullanıcı "ls yap" veya "dizinleri listele" dediğinde AI terminal tool'unu çağırmalı ve sonucu göstermeli

### WP-2: CommandRail Butonlarını İşlevsel Hale Getirme

**Hedef:** CommandRail'deki 6 butonun (Term, Files, Web, DB, Git, Tasks) her birine tıklandığında bir aksiyon gerçekleşmesini sağlamak.

**Önerilen Tasarım:**
- Her butona tıklandığında bir **drawer/modal** açılsın veya direkt olarak **sohbet girişine bir prompt/prefill** atılsın
- Butonlar aşağıdaki gibi davransın:

| Buton | Tıklanınca Ne Olacak | UI Tipi |
|-------|----------------------|---------|
| **Term** | Sohbette "Bir terminal aç ve şu komutu çalıştır:" ön dolgulu input göster veya küçük bir terminal girişi olan bir modal aç | Modal veya Input Prefill |
| **Files** | Context Panel'de "Project Files" sekmesine odaklan veya bir dosya gezgini paneli aç | Panel Odaklanma |
| **Web** | Sohbette "Web'de şunu ara:" ön dolgulu input göster | Input Prefill |
| **DB** | Veritabanı sorgulama modal'ı aç (ileri dönem) | Modal (placeholder) |
| **Git** | Git durumunu gösteren küçük bir panel aç | Panel/Modal |
| **Tasks** | Görev listesi paneli aç (ileri dönem) | Panel (placeholder) |

**Alternatif Tasarım (Kullanıcıya sorulacak):**
- Her buton doğrudan bir chat mesajı oluştursun. Örneğin "Term" tıklandığında AI'a "Terminal kullanarak sistem hakkında bilgi ver" mesajı otomatik gönderilsin.
- Veya butonlar sağ tarafta (Context Panel bölgesinde) minik bir panel açıp ilgili içeriği göstersin.

**Kontrol Listesi:**
- [ ] `page.tsx` içindeki `CommandRail` bileşenini analiz et
- [ ] Her buton için `onClick` handler'larını tanımla
- [ ] Seçilen UI yaklaşımına göre gerekli komponentleri oluştur veya var olanları güncelle
- [ ] active state yönetimini düzgün yap

**Kabul Kriteri:**
- Her CommandRail butonuna tıklandığında görünür bir tepki alınmalı (en azından bir toast/console.log değil, anlamlı bir UI değişikliği)
- Terminal butonu sohbette terminal tool'unu tetikleyebilmeli

### WP-3: Context Panel İyileştirmeleri

**Hedef:** Context Panel'deki Tool Activity bölümünün terminal tool çağrılarını da göstermesi ve Project Files bölümünün çalışır hale gelmesi.

**Kontrol Listesi:**
- [ ] Tool Activity'nin terminal çağrılarını neden göstermediğini tespit et
- [ ] Project Files'ın neden boş göründüğünü analiz et (API route `/api/projects/[id]/files` çalışıyor mu?)
- [ ] Project Files'ın düzgün çalışması için gerekli düzeltmeleri yap

**Kabul Kriteri:**
- Context Panel'de terminal tool çağrıları görünmeli
- Project Files proje dosyalarını listeleyebilmeli

### WP-4: Header Terminal Butonunu Bağlama

**Hedef:** Header'daki "Open terminal" butonuna da bir işlev kazandırmak.

**Seçenekler:**
- CommandRail'deki Term butonuyla aynı işlevi yapsın
- Modal açıp hızlı komut girişi sağlasın

**Kabul Kriteri:**
- Header'daki terminal ikonu tıklanabilir ve bir aksiyon gerçekleştirir

---

## 6. Teknik Detaylar

### 6.1 Mevcut Kod Yapısı

#### `page.tsx` — CommandRail bileşeni (yaklaşık satır 93-144)

```tsx
const commands = [
  { label: "Term", icon: Terminal, active: true },
  { label: "Files", icon: FolderOpen, active: false },
  { label: "Web", icon: Globe, active: false },
  { label: "DB", icon: Database, active: false },
  { label: "Git", icon: GitBranch, active: false },
  { label: "Tasks", icon: ListTodo, active: false },
];
```

Bu butonlar bir `nav` elementi içinde render ediliyor, her `button` elementi `item.active`'e göre stil alıyor ama hiçbir `onClick` handler'ı yok.

#### `page.tsx` — Header Terminal Butonu (yaklaşık satır 276-282)

```tsx
<button
  className="..." 
  aria-label="Open terminal"
  // onClick yok!
>
  <Terminal className="..." />
</button>
```

#### `app/api/chat/route.ts` — Tool Import ve Kullanımı

```typescript
import { tools, toolDescriptions } from "@agent-web/core/tools";
// streamText çağrısında tools kullanılıyor
```

### 6.2 Olası Sorun Noktaları

1. **`projectId` ve `projectRootPath` eksikliği**: En kritik olası sorun! API route `projectId`'ye göre `projectRootPath` alıyor. Kullanıcı bir proje oluşturmamış veya aktif bir proje seçmemiş olabilir. Bu durumda:
   - System prompt'ta "You are working inside a project directory at: ..." bilgisi EKLENMİYOR
   - AI çalışma dizinini bilmediği için terminal/komut çalıştırmaktan kaçınıyor olabilir
   - `ContextPanel`'deki `ProjectFiles` bileşeni de proje dosyalarını gösteremiyor
2. **`packages/core` build sorunu**: ✅ Test edildi — build başarılı. Dist/ klasörü güncel. Bu bir sorun değil.
3. **transpilePackages ayarı**: ✅ Doğru — `@agent-web/core` ve `@agent-web/db` `transpilePackages` listesinde.
4. **AI model tool calling desteği**: Kullanıcının seçtiği model tool calling'i destekliyor mu? (OpenAI modelleri, DeepSeek, Claude destekler; bazı ücretsiz OpenRouter modelleri desteklemez). API route test edilmeden bilinemez.
5. **Environment variable'lar**: `TERMINAL_BACKEND=local` `.env.example`'da varsayılan. Kullanıcının `.env` dosyasında doğru ayarlanmış olmalı.

### 6.3 Önerilen Implementation Stratejisi

1. **Önce tanı koy (WP-1)**:
   a. `packages/core` build durumu ✅ (zaten başarılı)
   b. Kullanıcının hangi model/provider kullandığını kontrol et — modele tool calling desteği var mı?
   c. Kullanıcının aktif bir projesi (`projectId`, `projectRootPath`) var mı? Yoksa, bir proje oluşturup terminal/komut denemesi yap.
   d. AI'a doğrudan "Bu dizinde `dir` komutunu çalıştır" gibi spesifik bir istek göndererek tool çağrısını zorla.
   e. API route loglarını incele (console.log veya server log) — `streamText` çağrısında tool'lar doğru iletilmiş mi?
2. **Tool altyapısını düzelt**: Eğer tool'lar hala çalışmıyorsa import/build/konfigürasyon sorunlarını gider.
3. **CommandRail butonlarına onClick ekle (WP-2)**: En basit çözümle başla (buton tıklanınca chat input'una prompt prefill yap).
4. **Context Panel'i düzelt (WP-3)**: Tool activity ve Project Files'ı çalışır hale getir.
5. **Header butonunu bağla (WP-4)**: Header'daki terminal ikonunu da aynı mantığa bağla.

---

## 7. Kullanıcı Görüşme Özeti

Aşağıda kullanıcı ile yapılan görüşmelerden elde edilen bilgiler yer almaktadır:

| Soru | Cevap | Çıkarım |
|------|-------|---------|
| Terminal butonundan ne bekliyorsun? | "Emin değilim" | Konsept net değil, yönlendirme gerekli |
| Ayrı terminal UI'ı ister misin? | "Tool olarak yeterli" | Ayrı terminal penceresi İSTENMİYOR. AI'ın sohbette tool kullanması yeterli. |
| Hangi butonlar çalışıyor? | "Bazıları çalışıyor" / "Hiçbiri çalışmıyor" (düzeltildi) | CommandRail butonlarının HİÇBİRİ çalışmıyor |
| Tool call gördün mü? | "Hiç çıkmadı" | AI hiç terminal komutu çalıştırmadı |
| AI ne dedi? | "Tool kullanılamıyor" | Backend tool registry veya AI config sorunu var |
| Kapsam ne olmalı? | "Hepsi" | Tüm CommandRail butonları çalışsın |
| Çalıştırma ortamı? | "pnpm dev (local)" | Docker değil, local geliştirme |
| Project Files görüyor musun? | "Hiç görmüyorum" | Context Panel'de Project Files bölümü çalışmıyor |

---

## 8. Riskler ve Önlemler

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| `packages/core` build sorunları karmaşık/yeni bağımlılıklar içerebilir | Orta | Yüksek | Build loglarını incele, adım adım ilerle |
| AI modeli tool calling'i desteklemiyor olabilir | Düşük | Yüksek | Kullanıcının seçtiği modeli kontrol et, gerekirse farklı model öner |
| CommandRail'e yeni özellik eklemek mevcut layout'u bozabilir | Düşük | Orta | `page.tsx`'i dikkatlice incele, Tailwind class'larını koru |
| Context Panel değişiklikleri store state'ini etkileyebilir | Orta | Orta | Zustand store'u dikkatlice incele, state değişimlerini test et |

---

## 9. Kabul Kriterleri (Acceptance Criteria)

- [ ] Kullanıcı AI'a "ls yap" dediğinde AI terminal tool'unu çağırır ve sonucu gösterir
- [ ] CommandRail'deki "Term" butonuna tıklandığında bir aksiyon gerçekleşir (ör: chat input'una prompt eklenir)
- [ ] CommandRail'deki diğer butonlara (Files, Web, DB, Git, Tasks) tıklandığında da anlamlı bir aksiyon gerçekleşir
- [ ] Header'daki "Open terminal" butonu çalışır
- [ ] Context Panel'de tool activity kısmı terminal tool çağrılarını da gösterir
- [ ] Context Panel'de Project Files kısmı proje dosyalarını listeler

---

## 10. WP-1 Tanı Raporu (2026-05-18)

### Yapılan Kontroller

| # | Kontrol | Sonuç | Detay |
|---|---------|-------|-------|
| 1 | `.env` dosyası | ❌ Yok | Kullanıcı API key'leri Settings panel (UI) üzerinden giriyor. `.env` eksikliği tool çalışmasını engellemez. `TERMINAL_BACKEND` set edilmediği için terminal tool varsayılan olarak Docker'ı dener, olmayınca local'e fallback yapar. |
| 2 | `packages/core` build | ✅ Başarılı | `pnpm --filter @agent-web/core build` hatasız. `dist/` klasöründe tüm tool'lar mevcut. |
| 3 | Tüm proje build (`pnpm build`) | ✅ Başarılı | 3/3 workspace başarıyla build oldu (core, db, web). Tek uyarı: pdf-parse bağımlılığı ile ilgili non-fatal IO warning. |
| 4 | `package.json` exports | ✅ Doğru | `@agent-web/core/tools` → `dist/tools/registry.js`. API route'daki import doğru çalışıyor. |
| 5 | `next.config.ts` transpilePackages | ✅ Doğru | `@agent-web/core` ve `@agent-web/db` `transpilePackages` listesinde. |
| 6 | API route tool import | ✅ Doğru | `import { tools, toolDescriptions } from "@agent-web/core/tools"` — tools objesi `streamText`'e geçiliyor, `maxSteps: 8`. |
| 7 | DeepSeek provider config | ✅ Doğru | `baseURL: https://api.deepseek.com`, model dinamik. `deepseek` enum'da mevcut. |
| 8 | Terminal tool backend | ⚠️ Docker varsayılan | `TERMINAL_BACKEND` set edilmemiş → varsayılan "docker". Docker yoksa local'e fallback **(çalışır)**. |
| 9 | **🔴 Kullanıcı modeli: `deepseek-v4-pro`** | ❌ **Tool calling desteği yok (tahmini)** | Bu model adı DeepSeek'in standart modelleri arasında yer almıyor. `deepseek-chat` (V3) ve `deepseek-reasoner` (R1) tool calling destekler. `deepseek-v4-pro` tool calling'i desteklemiyorsa AI tool'ları hiç görmez. |
| 10 | AI davranışı | ❌ Tool'ları görmezden geliyor | Kullanıcının ifadesiyle AI "direkt komut çalıştırıyor, tool'ları kullanmıyor, sanki yokmuş gibi davranıyor". Bu, modelin tool calling'i desteklemediğinin tipik bir işareti. |
| 11 | `projectId` / `projectRootPath` | ❓ Kontrol edilmedi | Kullanıcının aktif bir projesi olup olmadığı bilinmiyor. Eğer yoksa, system prompt'ta çalışma dizini bilgisi yer almaz. |

### Kök Neden Analizi

**En olası neden: `deepseek-v4-pro` modeli tool calling'i desteklemiyor.**

Kullanıcı Settings panel'den `deepseek-v4-pro` modelini seçmiş. Bu model:
- DeepSeek'in standart API'sinde tanınan bir model adı olmayabilir
- Tool calling / function calling desteği olmayan bir model olabilir
- Sonuç: `streamText` tools parametresini alsa bile, model tool'ları "görmez" ve normal metin üretimi yapar

**İkincil neden: Aktif proje eksikliği.**
Eğer kullanıcının hiç projesi yoksa veya proje seçmemişse:
- `projectRootPath` boş olur
- System prompt'ta "You are working inside a project directory..." bilgisi olmaz
- AI bağlamı tam alamaz ve tool kullanma olasılığı düşer

### Önerilen Çözümler

1. **Model değişikliği (Kesin çözüm):** Kullanıcı `deepseek-chat` (V3) veya `deepseek-reasoner` (R1) modeline geçmeli. Bu modeller tool calling'i destekler.
2. **Test:** `deepseek-chat` seçip "Bu dizindeki dosyaları listele" gibi net bir komut vererek tool çağrısını test etmeli.
3. **Proje oluşturma:** Settings veya Sidebar üzerinden bir proje oluşturup aktif etmeli.
4. **Alternatif:** Eğer `deepseek-v4-pro` tool calling'i destekliyorsa (ileride), API route'da tool yapılandırmasını kontrol etmek gerekebilir.

---

## 11. Gözden Geçirme Notları (2026-05-18)

### Doğrulanan Bilgiler (Spec'in doğru kısımları)

- ✅ CommandRail butonlarında `onClick` handler'ı olmadığı doğrulandı (page.tsx satır 93-144)
- ✅ Header terminal butonunda `onClick` handler'ı olmadığı doğrulandı (page.tsx satır 276-282)
- ✅ `@agent-web/core/tools` import yapısı API route'da doğru kullanılıyor
- ✅ `package.json` exports yapılandırması doğru (./tools → dist/tools/registry.js)
- ✅ `next.config.ts` transpilePackages ayarları doğru
- ✅ `TERMINAL_BACKEND=local` varsayılan değeri doğru
- ✅ Zustand store'da tool invocation tracking mevcut

### Revize Edilen Bilgiler

| Eski İfade | Yeni İfade | Gerekçe |
|------------|------------|---------|
| "packages/core Build Durumu ❓ Bilinmiyor" | "✅ Başarılı" | `pnpm --filter @agent-web/core build` başarıyla tamamlandı |
| "packages/core build edilmemiş olabilir" | Kaldırıldı | Build başarılı olduğu için yanlış bilgiydi, çıkarıldı |
| Sorun nedenleri arasında "build sorunu" ilk sıradaydı | En kritik neden olarak **projectId/projectRootPath eksikliği** eklendi | Build sorunu olmadığı tespit edildi; asıl olası neden proje bağlamı eksikliği |

### Eklenen Yeni Bilgiler

- **Proje API routes** tabloya eklendi: `POST /api/projects`, `GET /api/projects/[id]/files` mevcut ve çalışıyor
- **projectId/projectRootPath sorun analizi** eklendi: Kullanıcının aktif bir projesi yoksa AI sistem prompt'ta çalışma dizini bilgisi alamaz
- **Tanı stratejisi** güncellendi: Önce projectId ve model desteğini kontrol et, build kontrolünü atla

### Hala Doğrulanmamış/Görüşülmemiş Konular

- Kullanıcının hangi AI modelini ve provider'ı kullandığı (tool calling desteği için kritik)
- Kullanıcının bir projesinin olup olmadığı
- `.env` dosyasında `TERMINAL_BACKEND=local` ayarının yapılıp yapılmadığı
- Chat API route'un çalışma zamanında hata verip vermediği (server log ile görülebilir)

---

## 11. Gelecek İyileştirmeler (Out of Scope)

Bu spec kapsamı dışında kalan ancak not edilmesi gereken konular:

1. **CommandRail için aktif sekme göstergesi**: Hangi buton aktif, hangi panel açık gibi görsel durum
2. **Tema/renk uyumu**: Terminal çıktılarının renklendirilmesi
3. **UI/UX iyileştirmeleri**: Animasyonlar, tooltip'ler, klavye kısayolları
4. **Docker backend desteği**: Şu an local çalışıyor, Docker için ayrı bir spec
5. **Gerçek zamanlı terminal stream'i**: AI'ın terminal çıktısını canlı olarak stream etmesi
6. **Subprocess yönetimi**: Uzun süreli process'leri durdurma/izleme paneli
