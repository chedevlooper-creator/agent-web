# Checklist: Agent Web Güvenlik ve Kalite İyileştirme

## Spec Onayı

- [x] Kullanıcı spec.md dosyasını inceleyip onayladı

## Güvenlik İyileştirmeleri

- [x] API key server-side environment variable desteği eklendi
- [x] Admin panel'den key girişi için encrypted storage eklendi
- [x] Client-side store'dan apiKey kaldırıldı
- [x] Chat API route server-side key kullanıyor
- [x] Rate limiting middleware oluşturuldu
- [x] Chat endpoint rate limit: 20 req/dk uygulandı
- [x] Tool execution rate limit uygulandı
- [x] Rate limit exceeded formatı tanımlandı

## Input Validation

- [x] Zod schemas dosyası oluşturuldu
- [x] ChatRequest schema tanımlandı
- [x] ToolExecution schema tanımlandı
- [x] Memory/Skills/Cron schemas tanımlandı
- [x] Tüm API route'larda validation uygulandı

## Path Traversal Koruması

- [x] realpath() ile symlink çözümleme eklendi
- [x] File tool path validation güçlendirildi
- [x] Terminal tool cwd validation eklendi
- [x] Path traversal test cases yazıldı
- [x] /etc/passwd gibi path'ler engelleniyor
- [x] Symlink attack'lar engelleniyor

## Database & Performance

- [x] Drizzle connection pooling aktif
- [x] Pool size yapılandırıldı
- [x] Connection leak detection eklendi

## Error Handling

- [x] AppError class oluşturuldu
- [x] Error response format standardize edildi
- [x] Global error handler middleware eklendi
- [x] Tüm API route'larda yeni error format kullanılıyor
- [x] Error codes tanımlandı

## Code Quality

- [x] packages/core/src/types.ts singleton source oldu
- [x] Frontend store types core'dan import ediyor
- [x] Duplicate type tanımları kaldırıldı
- [x] Provider constants tanımlandı
- [x] Toolset constants tanımlandı
- [x] Status constants tanımlandı
- [x] Magic strings constants ile değiştirildi

## Integration

- [x] Feature flag ile gradual rollout stratejisi uygulandı
- [x] Geriye dönük uyumluluk korundu
- [x] Legacy endpoint'ler çalışıyor
