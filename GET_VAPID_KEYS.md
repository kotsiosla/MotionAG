# 🔑 Πώς να πάρεις τα VAPID Keys

## 🎯 Το function είναι: https://jftthfniwfarxyisszjh.supabase.co/functions/v1/generate-vapid-keys

---

## Μέθοδος 1: Από το Supabase Dashboard (Προτεινόμενη)

### Βήμα 1: Άνοιξε το Function
1. Στο Supabase Dashboard → **Edge Functions**
2. Βρες το **"generate-vapid-keys"** στη λίστα
3. Κάνε click πάνω του

### Βήμα 2: Καλέσε το Function
1. Κάνε click **"Invoke function"** (ή "Run")
2. Περίμενε λίγο
3. Θα δεις response με τα keys

### Βήμα 3: Αντιγράψε τα Keys
Θα δεις κάτι σαν:
```json
{
  "success": true,
  "keys": {
    "VAPID_PUBLIC_KEY": "...",
    "VAPID_PRIVATE_KEY": "..."
  }
}
```

Αντιγράψε:
- Το `VAPID_PUBLIC_KEY` value
- Το `VAPID_PRIVATE_KEY` value

---

## Μέθοδος 2: Με Browser (Direct Call)

### Βήμα 1: Άνοιξε νέο tab
1. Άνοιξε: https://jftthfniwfarxyisszjh.supabase.co/functions/v1/generate-vapid-keys
2. Θα δεις JSON response με τα keys

### Βήμα 2: Αντιγράψε τα Keys
- Αντιγράψε το `VAPID_PUBLIC_KEY`
- Αντιγράψε το `VAPID_PRIVATE_KEY`

---

## Μέθοδος 3: Με curl (Terminal)

```bash
curl https://jftthfniwfarxyisszjh.supabase.co/functions/v1/generate-vapid-keys
```

---

## 📝 Μετά: Προσθήκη στο Supabase

1. **Settings** → **Edge Functions** → **Environment Variables**
2. **Add new variable:**
   - Name: `VAPID_PUBLIC_KEY`
   - Value: (το public key)
3. **Add new variable:**
   - Name: `VAPID_PRIVATE_KEY`
   - Value: (το private key)

---

**Καλή τύχη! 🚀**


