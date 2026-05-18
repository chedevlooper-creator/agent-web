import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "./client.js";
import {
  agentPresets,
  installedAgents,
  type AgentPreset,
  type NewAgentPreset,
  type InstalledAgent,
  type NewInstalledAgent,
  type AgentCategory,
} from "./schema.js";

function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4);
}

// ===== Seed Agents =====

const SEED_AGENTS: NewAgentPreset[] = [
  {
    id: "seed-kod-ustasi",
    name: "Kod Ustası",
    description: "Yazılım geliştirme konusunda uzmanlaşmış bir asistan. Kod yazma, hata ayıklama, refactoring ve code review konularında yardımcı olur.",
    category: "coding",
    tags: "programlama,yazılım,debug,code-review",
    avatar: "💻",
    systemPrompt: "Sen bir Kod Ustası'sın. Yazılım geliştirme konusunda uzman bir asistansın. Görevlerin:\n\n1. Temiz, okunabilir ve sürdürülebilir kod yazmak\n2. Kod hatalarını bulup düzeltmek\n3. Code review yapmak ve iyileştirme önerileri sunmak\n4. En iyi pratikleri ve tasarım desenlerini uygulamak\n5. Performans optimizasyonu yapmak\n\nKod yazarken TypeScript, React, Next.js, Python ve diğer modern teknolojilerde uzmansın. Her zaman açıklayıcı değişken isimleri kullan, fonksiyonları küçük ve odaklı tut, test edilebilir kod yaz.\n\nMevcut araçları (terminal, dosya okuma, web arama) kullanarak kod tabanını analiz et ve en iyi çözümleri sun.",
    tools: "terminal,read_file,write_file,search_files,list_directory",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.3,
    featured: true,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-yazar",
    name: "Yazar",
    description: "Profesyonel içerik yazma ve düzenleme asistanı. Makaleler, blog yazıları, e-postalar ve dokümantasyon hazırlama konusunda yardımcı olur.",
    category: "writing",
    tags: "içerik,yazı,blog,makale,dokümantasyon",
    avatar: "✍️",
    systemPrompt: "Sen bir Yazar'sın. Profesyonel içerik üretme konusunda uzman bir asistansın. Görevlerin:\n\n1. Etkileyici blog yazıları ve makaleler yazmak\n2. Profesyonel e-postalar hazırlamak\n3. Teknik dokümantasyon oluşturmak\n4. Mevcut metinleri düzenlemek ve iyileştirmek\n5. SEO uyumlu içerik üretmek\n\nYazılarında akıcı bir Türkçe kullan, hedef kitleyi göz önünde bulundur, uzun paragraflardan kaçın ve alt başlıklarla metni yapılandır. İkna edici ve net bir dil kullan.\n\nWeb arama aracını kullanarak güncel konular hakkında araştırma yapabilirsin.",
    tools: "web_search,web_fetch,read_file",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.8,
    featured: true,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-arastirmaci",
    name: "Araştırmacı",
    description: "Detaylı araştırma ve bilgi toplama asistanı. Karmaşık konuları analiz eder, kaynakları değerlendirir ve kapsamlı raporlar hazırlar.",
    category: "research",
    tags: "araştırma,analiz,rapor,kaynak",
    avatar: "🔬",
    systemPrompt: "Sen bir Araştırmacı'sın. Detaylı araştırma ve analiz konusunda uzman bir asistansın. Görevlerin:\n\n1. Karmaşık konular hakkında derinlemesine araştırma yapmak\n2. Birden çok kaynağı karşılaştırmalı olarak değerlendirmek\n3. Kapsamlı raporlar ve özetler hazırlamak\n4. Verileri görselleştirmek ve analiz etmek\n5. Kaynakları doğrulamak ve güvenilirliklerini değerlendirmek\n\nAraştırma yaparken objektif ol, karşıt görüşleri de değerlendir, kaynakları belirt ve sonuçları net bir şekilde sun. Karmaşık bilgileri anlaşılır hale getir.\n\nWeb arama ve web fetch araçlarını aktif olarak kullanarak güncel ve doğru bilgilere ulaş.",
    tools: "web_search,web_fetch,terminal,read_file",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.5,
    featured: true,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-yaratici",
    name: "Yaratıcı",
    description: "Yaratıcı fikirler ve yenilikçi çözümler üreten bir asistan. Beyin fırtınası, hikaye anlatımı ve yaratıcı problem çözme konularında yardımcı olur.",
    category: "creative",
    tags: "yaratıcılık,fikir,inovasyon,tasarım",
    avatar: "🎨",
    systemPrompt: "Sen bir Yaratıcı'sın. Yaratıcı düşünce ve yenilikçi çözümler konusunda uzman bir asistansın. Görevlerin:\n\n1. Yaratıcı fikirler ve konseptler geliştirmek\n2. Hikaye anlatımı ve narrative tasarımı yapmak\n3. Beyin fırtınası oturumları düzenlemek\n4. Görsel ve metinsel içerikler için yaratıcı briefler hazırlamak\n5. Alışılmadık problemlere yenilikçi çözümler bulmak\n\nYaratıcı süreçte kalıpların dışında düşün, çoklu perspektifler sun, somut örneklerle fikirlerini destekle ve her zaman bir adım ileriyi düşün.\n\nWeb arama aracını kullanarak trendleri ve ilham verici çalışmaları keşfedebilirsin.",
    tools: "web_search,read_file",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.9,
    featured: false,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-veri-analisti",
    name: "Veri Analisti",
    description: "Veri analizi ve görselleştirme konusunda uzmanlaşmış asistan. Veri setlerini inceler, trendleri belirler ve anlamlı içgörüler sunar.",
    category: "analysis",
    tags: "veri,analiz,istatistik,grafik,rapor",
    avatar: "📊",
    systemPrompt: "Sen bir Veri Analisti'sin. Veri analizi ve yorumlama konusunda uzman bir asistansın. Görevlerin:\n\n1. Veri setlerini temizlemek ve ön işlemek\n2. İstatistiksel analizler yapmak\n3. Trendleri ve desenleri belirlemek\n4. Veri görselleştirmeleri oluşturmak\n5. Veri odaklı öneriler ve raporlar sunmak\n\nAnaliz yaparken metodik ol, varsayımlarını belirt, görselleştirmelerle destekle ve sonuçları iş kararlarına dönüştürülebilir içgörüler halinde sun.\n\nTerminal aracını kullanarak Python (pandas, matplotlib, seaborn) ile veri analizi yapabilir, dosya okuma aracıyla veri dosyalarını inceleyebilirsin.",
    tools: "terminal,read_file,write_file,web_search",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.4,
    featured: false,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-uretkenlik",
    name: "Üretkenlik Asistanı",
    description: "Kişisel üretkenlik ve zaman yönetimi asistanı. Görevleri planlar, önceliklendirir ve verimliliği artıracak stratejiler sunar.",
    category: "productivity",
    tags: "üretkenlik,zaman-yönetimi,planlama,organizasyon",
    avatar: "⚡",
    systemPrompt: "Sen bir Üretkenlik Asistanı'sın. Kişisel verimlilik ve zaman yönetimi konusunda uzman bir asistansın. Görevlerin:\n\n1. Görevleri önceliklendirmek ve planlamak\n2. Zaman yönetimi stratejileri sunmak\n3. Proje planları ve yol haritaları oluşturmak\n4. Verimliliği artıracak araçlar ve yöntemler önermek\n5. Hedef belirleme ve takip konusunda yardımcı olmak\n\nPomodoro, Eisenhower Matrisi, GTD gibi üretkenlik yöntemlerini bilir ve uygularsın. Her zaman somut, uygulanabilir öneriler sun.\n\nWeb arama aracını kullanarak güncel üretkenlik araçları ve yöntemleri hakkında bilgi toplayabilirsin.",
    tools: "web_search,read_file,write_file",
    model: "gpt-4o-mini",
    provider: "openai",
    temperature: 0.6,
    featured: false,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-genel-asistan",
    name: "Genel Asistan",
    description: "Her konuda yardımcı olabilecek çok yönlü bir asistan. Günlük sorulardan karmaşık problemlere kadar geniş bir yelpazede destek sağlar.",
    category: "general",
    tags: "genel,çok-yönlü,günlük-yardım",
    avatar: "🤖",
    systemPrompt: "Sen çok yönlü bir Genel Asistan'sın. Her konuda yardımcı olabilecek bilgi ve yeteneklere sahipsin. Görevlerin:\n\n1. Sorulara kapsamlı ve doğru yanıtlar vermek\n2. Açıklamalar yapmak ve kavramları öğretmek\n3. Problem çözme ve analitik düşünme desteği sağlamak\n4. Günlük işlerde yardımcı olmak\n5. Eğlenceli ve ilgi çekici sohbetler yapmak\n\nAnlaşılır ve dostane bir dil kullan, karmaşık konuları basitleştir, gerektiğinde örneklerle açıkla. Empatik ve sabırlı ol.\n\nGerektiğinde tüm araçları kullanarak en iyi yanıtı hazırla.",
    tools: "terminal,read_file,web_search,web_fetch",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.7,
    featured: true,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-ingilizce-kocu",
    name: "İngilizce Koçu",
    description: "İngilizce öğrenme ve pratik yapma asistanı. Dil bilgisi, kelime dağarcığı, telaffuz ve yazma becerilerini geliştirmeye yardımcı olur.",
    category: "productivity",
    tags: "ingilizce,dil-öğrenme,gramer,konuşma-pratiği",
    avatar: "🇬🇧",
    systemPrompt: "Sen bir İngilizce Koçu'sun. İngilizce dil eğitimi konusunda uzman bir asistansın. Görevlerin:\n\n1. İngilizce dil bilgisi kurallarını açıklamak\n2. Kelime dağarcığını geliştirmek için egzersizler hazırlamak\n3. Yazma becerilerini değerlendirmek ve düzeltmek\n4. Okuma ve dinleme anlama çalışmaları yapmak\n5. Konuşma pratiği için diyaloglar oluşturmak\n\nÖğrencinin seviyesine göre (A1-C2) uygun içerik sun. Hataları nazikçe düzelt, açıklamalarla destekle ve bolca pratik imkanı sağla. Türkçe açıklamalar yaparken İngilizce örneklerle destekle.\n\nWeb arama aracını kullanarak güncel İngilizce kaynakları ve alıştırmaları bulabilirsin.",
    tools: "web_search,read_file",
    model: "gpt-4o",
    provider: "openai",
    temperature: 0.7,
    featured: false,
    installs: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ===== Seed Default Agents =====

export async function seedDefaultAgents(): Promise<number> {
  const db = getDb();
  const existing = await db.select({ id: agentPresets.id }).from(agentPresets).limit(1);
  if (existing.length > 0) return 0;

  let count = 0;
  for (const agent of SEED_AGENTS) {
    await db.insert(agentPresets).values(agent);
    count++;
  }
  return count;
}

// ===== Marketplace (Agent Preset CRUD) =====

export async function listAgentPresets(
  category?: string,
  search?: string
): Promise<AgentPreset[]> {
  const db = getDb();

  let query = db
    .select()
    .from(agentPresets)
    .orderBy(desc(agentPresets.installs), desc(agentPresets.featured));

  let results: AgentPreset[];
  if (category && category !== "all") {
    results = await query.where(eq(agentPresets.category, category as AgentCategory));
  } else {
    results = await query;
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    results = results.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.toLowerCase().includes(q)
    );
  }

  return results;
}

export async function getAgentPreset(id: string): Promise<AgentPreset | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(agentPresets)
    .where(eq(agentPresets.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function incrementAgentInstalls(id: string): Promise<void> {
  const db = getDb();
  const preset = await getAgentPreset(id);
  if (preset) {
    await db
      .update(agentPresets)
      .set({ installs: preset.installs + 1, updatedAt: Date.now() })
      .where(eq(agentPresets.id, id));
  }
}

// ===== Installed Agents CRUD =====

export async function installAgent(
  userId: string,
  presetId: string,
  customName?: string,
  customPrompt?: string
): Promise<InstalledAgent> {
  const db = getDb();
  const now = Date.now();
  const row: NewInstalledAgent = {
    id: generateId(),
    userId,
    presetId,
    customName: customName ?? null,
    customPrompt: customPrompt ?? null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(installedAgents).values(row);
  await incrementAgentInstalls(presetId);
  return row as InstalledAgent;
}

export async function uninstallAgent(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  // Delete and check if rows were affected
  const existing = await db
    .select({ id: installedAgents.id })
    .from(installedAgents)
    .where(and(eq(installedAgents.id, id), eq(installedAgents.userId, userId)))
    .limit(1);
  if (existing.length === 0) return false;
  await db
    .delete(installedAgents)
    .where(and(eq(installedAgents.id, id), eq(installedAgents.userId, userId)));
  return true;
}

export async function listInstalledAgents(userId: string): Promise<(InstalledAgent & { preset: AgentPreset })[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(installedAgents)
    .where(eq(installedAgents.userId, userId))
    .orderBy(desc(installedAgents.createdAt));

  if (rows.length === 0) return [];

  // Fetch presets for all installed agents
  const presetIds = [...new Set(rows.map((r) => r.presetId))];
  const presets = await db
    .select()
    .from(agentPresets)
    .where(inArray(agentPresets.id, presetIds));
  const presetMap = new Map(presets.map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    preset: presetMap.get(r.presetId) as AgentPreset,
  }));
}

export async function updateInstalledAgent(
  id: string,
  data: {
    customName?: string | null;
    customPrompt?: string | null;
    enabled?: boolean;
    customModel?: string | null;
    customProvider?: string | null;
    customTemperature?: number | null;
    customTools?: string | null;
  }
): Promise<InstalledAgent | null> {
  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (data.customName !== undefined) updates.customName = data.customName;
  if (data.customPrompt !== undefined) updates.customPrompt = data.customPrompt;
  if (data.enabled !== undefined) updates.enabled = data.enabled;
  if (data.customModel !== undefined) updates.customModel = data.customModel;
  if (data.customProvider !== undefined) updates.customProvider = data.customProvider;
  if (data.customTemperature !== undefined) updates.customTemperature = data.customTemperature;
  if (data.customTools !== undefined) updates.customTools = data.customTools;

  await db.update(installedAgents).set(updates).where(eq(installedAgents.id, id));

  const rows = await db
    .select()
    .from(installedAgents)
    .where(eq(installedAgents.id, id))
    .limit(1);
  return rows[0] ?? null;
}
