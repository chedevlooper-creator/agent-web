# Agent Web — AI Developer Komuta Merkezi

## What This Is

Ekip içi AI geliştirme asistanı. 3 kişilik bir ekip, ortak bir sunucuda çalışan chat arayüzü üzerinden LLM'lere bağlanarak sohbet ediyor, terminal/dosya/web araçlarını kullanıyor ve birlikte proje geliştiriyor. Mevcut altyapı (Next.js 16, React 19, AI SDK v4, 8 araç, SQLite, Docker) üzerine çok kullanıcılı bir katman inşa ediliyor.

## Core Value

Ekip üyeleri AI araçlarını kullanarak birlikte yazılım geliştirebilmeli — herkesin kendi oturumu, kendi projeleri ve kendi API key'leri olmalı, birbirlerinin verisine karışmamalı.

## Requirements

### Validated

Mevcut kod tabanında çalışan ve doğrulanmış özellikler:

- ✓ **Chat arayüzü** — Zustand store ile çoklu model, stream parsing, tool invocation gösterimi — mevcut
- ✓ **8 araç (tools)** — terminal, read_file, write_file, web_search, web_fetch, list_directory, search_files, execute_code — mevcut ve çalışıyor
- ✓ **LLM provider desteği** — OpenAI, OpenRouter, OpenCode, DeepSeek (4 aktif, 9 yapılandırılmış bekliyor)
- ✓ **SQLite veritabanı** — projects, sessions, messages, api_keys tabloları — çalışıyor
- ✓ **Docker deployment** — dev ve prod compose yapılandırması, sandbox container
- ✓ **Şifreli API key saklama** — AES-256-GCM ile encrypt/decrypt
- ✓ **Dosya yükleme ve metin çıkarma** — PDF, DOCX, XLSX, code/text
- ✓ **Oturum/proje CRUD** — REST API üzerinden tam CRUD
- ✓ **Compare mode** — iki model yan yana karşılaştırma
- ✓ **Path traversal koruması** — dosya araçları workspace ile sınırlı

### Active

İnşa edilecek özellikler:

- [ ] **AUTH-01**: Kullanıcı adı + şifre ile giriş ekranı
- [ ] **AUTH-02**: Şifrelerin bcrypt ile hash'lenerek saklanması
- [ ] **AUTH-03**: Session/cookie tabanlı oturum yönetimi
- [ ] **AUTH-04**: Açık kayıt — herkes kendi hesabını oluşturabilsin
- [ ] **AUTH-05**: Her kullanıcı kendi session/project/key'lerini görsün (data isolation)
- [ ] **AUTH-06**: Middleware ile korunan route'lar
- [ ] **UX-01**: Login ekranı tasarımı
- [ ] **UX-02**: Kullanıcı bilgisi gösterimi (sidebar'da kimin giriş yaptığı)
- [ ] **UX-03**: Çıkış yapma butonu
- [ ] **UX-04**: Genel arayüz iyileştirmeleri (3 kişilik ekip için daha profesyonel görünüm)

### Out of Scope

- **E-posta ile kayıt/doğrulama** — Basit kullanıcı adı/şifre yeterli
- **Rol tabanlı yetkilendirme** — Herkes tam erişimli, admin/kullanıcı ayrımı yok
- **Şifre sıfırlama** — Admin manuel olarak halleder
- **E-posta bildirimleri** — Şimdilik gerekli değil
- **OAuth/SSO entegrasyonu** — Fazla karmaşık, 3 kişi için gereksiz

## Context

Mevcut kod tabanı tek kullanıcılı, local-first bir yapıda. Tüm state Zustand store'da yönetiliyor, localStorage'a UI tercihleri yazılıyor. API key'ler şifreli olarak DB'de saklanıyor ama kullanıcı bazında ayrım yok. Veritabanında zaten `users` tablosu yok — sıfırdan eklenmesi gerekiyor.

Arkadaşlarımız da aynı sunucuya bağlanacağı için:
- Her istekte kullanıcı kimliği doğrulanmalı
- Session'lar kullanıcıya ait olmalı
- API key'ler kullanıcı bazında şifrelenmeli
- Dosyalar kullanıcı bazında izole edilmeli

## Constraints

- **[Tech Stack]**: Mevcut stack korunacak (Next.js 16, React 19, SQLite, Drizzle, Zustand, Tailwind)
- **[Package Manager]**: pnpm 9.0.0 — değiştirilmeyecek
- **[Auth]**: Basit kullanıcı adı + şifre, bcrypt hash, session cookie
- **[Docker]**: Ortak sunucuda Docker compose ile çalışacak
- **[UI]**: Dark-first "Signal Cockpit" tasarım sistemi korunacak

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Kullanıcı adı + şifre (e-posta yok) | 3 kişilik ekip, basitlik önemli | — Pending |
| Açık kayıt | Herkes kendi hesabını oluşturabilsin | — Pending |
| Herkes tam erişimli | Admin/kullanıcı ayrımı yok, herkes tüm araçları kullanabilir | — Pending |
| Ortak sunucu | Docker compose ile herkes aynı instance'a bağlanacak | — Pending |
| Phase 1: Kullanıcı yönetimi + giriş | Olmazsa olmaz — multi-user'ın temeli | — Pending |

## Evolution

Bu doküman faz geçişlerinde ve milestone sonlarında güncellenir.

**Her faz geçişinden sonra:**
1. Geçersiz requirement'lar → Out of Scope'a taşınır
2. Doğrulanan requirement'lar → Validated'a taşınır
3. Yeni requirement'lar → Active'e eklenir
4. Kararlar → Key Decisions'a eklenir
5. "What This Is" hala doğru mu kontrol edilir

**Her milestone sonrası:**
1. Tüm bölümler gözden geçirilir
2. Core Value hala doğru öncelik mi?
3. Out of Scope nedenleri hala geçerli mi?
4. Context güncellenir

---
*Last updated: 2026-05-17 after initialization*
