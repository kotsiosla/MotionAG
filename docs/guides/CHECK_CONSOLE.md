# 🔍 Τι να δεις στο Console

## Άνοιξε το Console:
1. **F12** ή **Right-click → Inspect**
2. **Console tab**

## Τι να ψάξεις:

### 1. Supabase Configuration
Ψάξε για:
```
[Supabase Client] Configuration:
```
- Αν βλέπεις `keyExists: true` → ✅ OK
- Αν βλέπεις `keyExists: false` → ❌ Το key λείπει

### 2. Connection Test
Ψάξε για:
```
[Supabase Client] ✅ Connection test successful
```
ή
```
[Supabase Client] ❌ Connection test failed
```

### 3. Errors
Ψάξε για:
- Κόκκινα errors
- "Invalid API key"
- "Unexpected token"

## Αν βλέπεις `keyExists: true`:
✅ Το Supabase είναι configured
✅ Δοκίμασε να ενεργοποιήσεις notifications
✅ Το upsert θα δουλεύει

## Αν βλέπεις `keyExists: false`:
❌ Το `.env` file δεν διαβάστηκε
❌ Restart το dev server (Ctrl+C και `npm run dev`)

---

**Στείλε μου screenshot ή copy-paste από το Console!**
