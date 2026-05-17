# Requirements: Agent Web

**Defined:** 2026-05-17
**Core Value:** Ekip üyeleri AI araçlarını kullanarak birlikte yazılım geliştirebilmeli

## v1 Requirements

Phase 1 için requirements — çalışan bir giriş + multi-user sistemi.

### Authentication

- [ ] **AUTH-01**: Kullanıcı adı ile kayıt olma ekranı (e-posta yok, sadece username + şifre)
- [ ] **AUTH-02**: Kayıt olan kullanıcının şifresi bcrypt ile hash'lenip DB'ye kaydedilsin
- [ ] **AUTH-03**: Kullanıcı adı + şifre ile giriş yapma
- [ ] **AUTH-04**: Başarılı girişte cookie/session oluşturma
- [ ] **AUTH-05**: Oturum kapandığında veya süre dolduğunda çıkış
- [ ] **AUTH-06**: Her API route'da oturum doğrulama middleware'i
- [ ] **AUTH-07**: Kullanıcı adı uniqueness kontrolü (aynı username ile 2. kayıt engellensin)

### Data Isolation

- [ ] **ISOL-01**: Her kullanıcı sadece kendi session'larını görebilsin
- [ ] **ISOL-02**: Her kullanıcı sadece kendi projelerini görebilsin
- [ ] **ISOL-03**: Her kullanıcı sadece kendi API key'lerini görebilsin
- [ ] **ISOL-04**: Mevcut veritabanı şemasına `userId` alanı eklenip migration yazılsın

### UI / UX

- [ ] **UI-01**: Giriş/kayıt sayfası tasarımı (dark mode, mevcut tasarım sistemine uygun)
- [ ] **UI-02**: Ana sayfada sidebar'da kullanıcı adı gösterimi
- [ ] **UI-03**: Çıkış yap butonu
- [ ] **UI-04**: Giriş yapmamış kullanıcıyı login sayfasına yönlendirme
- [ ] **UI-05**: Kayıt/giriş hataları için kullanıcıya anlamlı mesaj gösterme

### Infrastructure

- [ ] **DB-01**: `users` tablosu ekleme (id, username, passwordHash, createdAt, updatedAt)
- [ ] **DB-02**: Mevcut tablolara `userId` foreign key ekleme migration'ı
- [ ] **DB-03**: `sessions` tablosu veya cookie-based session yönetimi
- [ ] **DB-04**: Migration sisteminin iyileştirilmesi (şu an raw SQL, versiyonlama eklenebilir)

## v2 Requirements

Sonraki fazlara ertelenenler.

### UI Improvements

- **UX-05**: Genel UI iyileştirmeleri (daha profesyonel görünüm, animasyonlar, responsive)
- **UX-06**: Kullanıcı profil sayfası (şifre değiştirme)
- **UX-07**: Admin paneli (kullanıcı listesi görme)

### New Tools

- **TOOL-01**: GitHub/versiyon kontrol araçları
- **TOOL-02**: Veritabanı sorgu aracı
- **TOOL-03**: API test aracı

### Database Improvements

- **DB-05**: N+1 query fix (export, import, message silme)
- **DB-06**: FTS5 full-text search (session/mesaj arama)
- **DB-07**: Uploaded file cleanup (TTL-based)

## Out of Scope

| Feature | Reason |
|---------|--------|
| E-posta ile kayıt/doğrulama | Basit username/şifre yeterli, 3 kişi için fazla |
| Rol tabanlı yetkilendirme | Herkes tam erişimli, admin/kullanıcı ayrımı yok |
| Şifre sıfırlama | Admin manuel halleder |
| OAuth/SSO | 3 kişi için gereksiz karmaşıklık |
| E-posta bildirimleri | Şimdilik gerekli değil |

## Traceability

### v1 — Multi-User MVP (20 requirements)

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| DB-01 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| UI-05 | Phase 2 | Pending |
| AUTH-06 | Phase 3 | Pending |
| ISOL-01 | Phase 3 | Pending |
| ISOL-02 | Phase 3 | Pending |
| ISOL-03 | Phase 3 | Pending |
| ISOL-04 | Phase 3 | Pending |
| DB-02 | Phase 3 | Pending |
| DB-03 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

### v2 — Post-MVP (10 requirements)

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-04 | Phase 5 | Pending |
| UX-05 | Phase 5 | Pending |
| UX-06 | Phase 5 | Pending |
| UX-07 | Phase 5 | Pending |
| DB-05 | Phase 6 | Pending |
| DB-06 | Phase 6 | Pending |
| DB-07 | Phase 6 | Pending |
| TOOL-01 | Phase 7 | Pending |
| TOOL-02 | Phase 7 | Pending |
| TOOL-03 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓
- v2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after traceability update (roadmap created)*
