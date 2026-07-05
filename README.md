# WellFed
Progetto di ingegneria del software 2025-2026

## Installazione
### Con npm
Clonare la repository con il comando:
```
git clone --recursive https://github.com/Nikicoraz/WellFed
```
Creare il file `.env` utilizzando come template il file `.env.example` (importante per impostare le credenziali del DB).


Installare le dipendenze npm con:
```
npm install
```
infine avviare il backend con:
```
npm run start
```

Per avviare il frontend:
```
cd frontend && npm install && npm run dev
```

### Con docker
Clonare la repository con il comando:
```
git clone --recursive https://github.com/Nikicoraz/WellFed
```
avviare il backend con il comando:
```
docker compose up
```
si possono configurare le variabili d'ambiente modificando il file docker-compose.yml

## Post-installazione
Una volta avviato il servizio utilizzando uno dei due metodi descritti sopra, se sono stati utilizzati i parametri di default, si può accedere al backend all'indirizzo `http://127.0.0.1:8000` e al frontend all'indirizzo `http://127.0.0.1:5173`


## Testare grafana
1. apri http://localhost:3000
2. logga in
Credenziali default
- Username: admin
- Password: admin
3. Add your first data source
4. Loki
5. sul campo url mettere "http://loki:3100"
6. Save & test
7. explore view
8. Su "Label filters" selezionare "job" "=" "/backend"
9. Live in alto a destra