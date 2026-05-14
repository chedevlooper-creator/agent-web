# Checklist: Agent Web Güvenlik ve Kalite İyileştirme

## Spec Onayı

- [ ] Kullanıcı spec.md dosyasını inceleyip onayladı

## Güvenlik İyileştirmeleri

- [ ] API key server-side environment variable desteği eklendi
- [ ] Admin panel'den key girişi için encrypted storage eklendi
- [ ] Client-side store'dan apiKey kaldırıldı
- [ ] Chat API route server-side key kullanıyor
- [ ] Rate limiting middleware oluşturuldu
- [ ] Chat endpoint rate limit: 20 req/dk uygulandı
- [ ] Tool execution rate limit uygulandı
- [ ] Rate limit exceeded formatı tanımlandı

## Input Validation

- [ ] Zod schemas dosyası oluşturuldu
- [ ] ChatRequest schema tanımlandı
- [ ] ToolExecution schema tanımlandı
- [ ] Memory/Skills/Cron schemas tanımlandı
- [ ] Tüm API route'larda validation uygulandı

## Path Traversal Koruması

- [ ] realpath() ile symlink çözümleme eklendi
- [ ] File tool path validation güçlendirildi
- [ ] Terminal tool cwd validation eklendi
- [ ] Path traversal test cases yazıldı
- [ ] /etc/passwd gibi path'ler engelleniyor
- [ ] Symlink attack'lar engelleniyor

## Database & Performance

- [ ] Drizzle connection pooling aktif
- [ ] Pool size yapılandırıldı
- [ ] Connection leak detection eklendi

## Error Handling

- [ ] AppError class oluşturuldu
- [ ] Error response format standardize edildi
- [ ] Global error handler middleware eklendi
- [ ] Tüm API route'larda yeni error format kullanılıyor
- [ ] Error codes tanımlandı

## Code Quality

- [ ] packages/core/src/types.ts singleton source oldu
- [ ] Frontend store types core'dan import ediyor
- [ ] Duplicate type tanımları kaldırıldı
- [ ] Provider constants tanımlandı
- [ ] Toolset constants tanımlandı
- [ ] Status constants tanımlandı
- [ ] Magic strings constants ile değiştirildi

## Integration

- [ ] Feature flag ile gradual rollout stratejisi uygulandı
- [ ] Geriye dönük uyumluluk korundu
- [ ] Legacy endpoint'ler çalışıyor
