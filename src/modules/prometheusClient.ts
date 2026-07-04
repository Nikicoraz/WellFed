import express from 'express';
import prometheus from "prom-client";

// prometheus.collectDefaultMetrics();

//
// All wellfed metrics get created in this file to keep track of which metrics have been created
//

const registeredClients = new prometheus.Counter({
    name: "registered_clients",
    help: "Number of registered clients"
});

const registeredMerchants = new prometheus.Counter({
    name: "registered_merchants",
    help: "Number of registered merchants"
});

const loginAttempts = new prometheus.Counter({
    name: "login_attempts",
    help: "Number of login attempts"
});

const loginErrors = new prometheus.Counter({
    name: "login_errors",
    help: "Number of failed login attempts"
});

const loginSuccess = new prometheus.Counter({
    name: "login_success",
    help: "Number of successful login attempts"
});

const activeUsers = new prometheus.Gauge({
    name: "active_users",
    help: "Number of currently active users"
});

const transactionCount = new prometheus.Counter({
    name: "transaction_count",
    help: "Number of created transactions"
});

const activeTransactions = new prometheus.Gauge({
    name: "active_transactions",
    help: "Number of currently active transactions"
});

const transactionDuration = new prometheus.Histogram({
    name: 'transaction_duration',
    help: 'How much time transactions take to finish',
    buckets: [15, 30, 45, 60, 75, 90, 105, 120],
});
// Expose metrics via URL

const metricRouter = express.Router();

metricRouter.get("/", async (req, res) => {
    try {
        res.set("Content-Type", prometheus.register.contentType);

        const metrics = await prometheus.register.metrics();
        res.end(metrics);
    } catch {
        res.status(500);
    }
});

export { 
    metricRouter, prometheus, registeredClients, registeredMerchants, loginAttempts, loginErrors, loginSuccess, 
    activeTransactions, activeUsers, transactionCount, transactionDuration 
};