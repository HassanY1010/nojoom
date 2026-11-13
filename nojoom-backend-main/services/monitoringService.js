import logger from '../utils/logger.js';

let sentry = null;
let promClient = null;

// Initialize Sentry dynamically
const initSentry = async () => {
    if (sentry) return sentry;
    const sentryDsn = process.env.SENTRY_DSN;
    if (sentryDsn) {
        try {
            sentry = await import('@sentry/node');
            sentry.init({
                dsn: sentryDsn,
                environment: process.env.NODE_ENV || 'development',
                tracesSampleRate: 1.0,
            });
            console.log('🛡️ Sentry Error Monitoring initialized');
        } catch (error) {
            console.warn('⚠️ Sentry DSN configured but SDK failed to load:', error.message);
        }
    } else {
        console.log('ℹ️ Sentry DSN not found, error monitoring running in mock mode');
    }
    return sentry;
};

// Initialize prom-client dynamically with memory fallback
const initPrometheus = async () => {
    if (promClient) return promClient;
    try {
        promClient = await import('prom-client');
        promClient.collectDefaultMetrics({ register: promClient.register });
        console.log('📊 Prometheus telemetry initialized via prom-client');
    } catch (error) {
        console.warn('⚠️ prom-client not installed, using high-performance mock telemetry collector');
        
        // Mock collector that formats metrics in Prometheus text format
        const mockStats = {
            httpRequestsTotal: {},
            httpRequestDuration: [],
            dbQueriesTotal: 0,
            dbQueryDuration: [],
            activeSockets: 0,
            errorsTotal: 0
        };

        promClient = {
            register: {
                metrics() {
                    const lines = [
                        '# HELP http_requests_total Total number of HTTP requests',
                        '# TYPE http_requests_total counter',
                    ];

                    for (const [key, count] of Object.entries(mockStats.httpRequestsTotal)) {
                        const [method, route, status] = key.split('|');
                        lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
                    }

                    lines.push('# HELP database_queries_total Total database queries executed');
                    lines.push('# TYPE database_queries_total counter');
                    lines.push(`database_queries_total ${mockStats.dbQueriesTotal}`);

                    lines.push('# HELP active_socket_connections Active Socket.IO connections');
                    lines.push('# TYPE active_socket_connections gauge');
                    lines.push(`active_socket_connections ${mockStats.activeSockets}`);

                    lines.push('# HELP errors_total Total unhandled system exceptions logged');
                    lines.push('# TYPE errors_total counter');
                    lines.push(`errors_total ${mockStats.errorsTotal}`);

                    // CPU & memory mock
                    const mem = process.memoryUsage();
                    lines.push('# HELP node_memory_usage_bytes Node process memory usage');
                    lines.push('# TYPE node_memory_usage_bytes gauge');
                    lines.push(`node_memory_usage_bytes{type="heapTotal"} ${mem.heapTotal}`);
                    lines.push(`node_memory_usage_bytes{type="heapUsed"} ${mem.heapUsed}`);
                    lines.push(`node_memory_usage_bytes{type="rss"} ${mem.rss}`);

                    return lines.join('\n');
                }
            },
            // Mock definitions
            Counter: class {
                constructor({ name, labelNames }) {
                    this.name = name;
                    this.labelNames = labelNames;
                }
                inc(labels, value = 1) {
                    if (this.name === 'errors_total') {
                        mockStats.errorsTotal += value;
                        return;
                    }
                    if (this.name === 'database_queries_total') {
                        mockStats.dbQueriesTotal += value;
                        return;
                    }
                    const key = `${labels.method}|${labels.route}|${labels.status}`;
                    mockStats.httpRequestsTotal[key] = (mockStats.httpRequestsTotal[key] || 0) + value;
                }
            },
            Histogram: class {
                constructor({ name }) {
                    this.name = name;
                }
                observe(value) {
                    if (this.name.includes('db')) {
                        mockStats.dbQueryDuration.push(value);
                    } else {
                        mockStats.httpRequestDuration.push(value);
                    }
                }
                startTimer() {
                    const start = Date.now();
                    return () => {
                        this.observe((Date.now() - start) / 1000);
                    };
                }
            },
            Gauge: class {
                constructor({ name }) {
                    this.name = name;
                }
                set(value) {
                    mockStats.activeSockets = value;
                }
                inc(value = 1) {
                    mockStats.activeSockets += value;
                }
                dec(value = 1) {
                    mockStats.activeSockets -= value;
                }
            }
        };
    }
    return promClient;
};

// Start initialization
initSentry();
const clientPromise = initPrometheus();

// Metrics definition references
let httpRequestsCounter;
let httpRequestDurationHistogram;
let dbQueriesCounter;
let dbQueryDurationHistogram;
let activeSocketConnectionsGauge;
let errorsCounter;

const getMetrics = async () => {
    const pm = await clientPromise;
    if (!httpRequestsCounter) {
        httpRequestsCounter = new pm.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status']
        });
        httpRequestDurationHistogram = new pm.Histogram({
            name: 'http_request_duration_seconds',
            help: 'HTTP request latency duration in seconds',
            labelNames: ['method', 'route', 'status'],
            buckets: [0.1, 0.3, 0.5, 1, 2, 5]
        });
        dbQueriesCounter = new pm.Counter({
            name: 'database_queries_total',
            help: 'Total database queries executed',
        });
        dbQueryDurationHistogram = new pm.Histogram({
            name: 'database_query_duration_seconds',
            help: 'Database query execution time in seconds',
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 3]
        });
        activeSocketConnectionsGauge = new pm.Gauge({
            name: 'active_socket_connections',
            help: 'Number of active Socket.IO connections'
        });
        errorsCounter = new pm.Counter({
            name: 'errors_total',
            help: 'Total unhandled system exceptions logged'
        });
    }
    return {
        httpRequestsCounter,
        httpRequestDurationHistogram,
        dbQueriesCounter,
        dbQueryDurationHistogram,
        activeSocketConnectionsGauge,
        errorsCounter,
        register: pm.register
    };
};

export const monitoringService = {
    // Sentry handlers getter
    getSentryHandlers() {
        return {
            requestHandler: sentry ? sentry.Handlers.requestHandler() : (req, res, next) => next(),
            errorHandler: sentry ? sentry.Handlers.errorHandler() : (err, req, res, next) => next(err)
        };
    },

    // Capture exception
    captureException(error, context = {}) {
        logger.error('💥 Exception captured:', error);
        getMetrics().then(m => m.errorsCounter.inc());
        if (sentry) {
            sentry.captureException(error, { extra: context });
        }
    },

    // Express duration middleware
    async requestDurationMiddleware(req, res, next) {
        const metrics = await getMetrics();
        const start = Date.now();

        // Intercept response finish
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            const route = req.route ? req.route.path : req.path;
            const method = req.method;
            const status = res.statusCode;

            metrics.httpRequestsCounter.inc({ method, route, status });
            metrics.httpRequestDurationHistogram.observe(duration);
        });

        next();
    },

    // Record Database Query Metrics
    async recordDatabaseQuery(durationMs) {
        try {
            const metrics = await getMetrics();
            metrics.dbQueriesCounter.inc();
            metrics.dbQueryDurationHistogram.observe(durationMs / 1000);
        } catch (e) {
            // ignore telemetry errors
        }
    },

    // Socket.IO tracking
    async updateActiveSockets(count) {
        try {
            const metrics = await getMetrics();
            metrics.activeSocketConnectionsGauge.set(count);
        } catch (e) {
            // ignore
        }
    },

    // Metrics scrape handler
    async metricsHandler(req, res) {
        try {
            const metrics = await getMetrics();
            res.set('Content-Type', metrics.register.contentType || 'text/plain; version=0.0.4; charset=utf-8');
            const data = await metrics.register.metrics();
            res.end(data);
        } catch (error) {
            console.error('Metrics scrape error:', error);
            res.status(500).end(error.message);
        }
    }
};

export default monitoringService;
