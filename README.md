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

Se si vuole avviare anche il simulatore di traffico si può eseguire il seguente comando:
```
docker compose --profile dev up
```

## Post-installazione
Una volta avviato il servizio utilizzando uno dei due metodi descritti sopra, se sono stati utilizzati i parametri di default, si può accedere al backend all'indirizzo `http://127.0.0.1:8000` e al frontend all'indirizzo `http://127.0.0.1:5173`


## Grafana setup
### Loki
1. Apri http://localhost:3000
2. Logga in
    Credenziali default
    - Username: admin
    - Password: admin
3. Add your first data source
4. Loki
5. Sul campo url mettere "http://loki:3100"
6. Save & test
7. Explore view
8. Su "Label filters" selezionare "job" "=" "/backend"
9. Live in alto a destra

### Prometheus
Per aggiungere prometheus il processo è simile a Loki, eccetto che nel campo url occorre mettere `http://prometheus:9090`