# Problem Statement

"Auth service is down AGAIN - users can't log in. We need all warning/error logs from the authentication service ASAP!" screams your manager. The `services.log` file contains millions of JSON entries (not in an array) like:

```json
{"timestamp": "2025-05-16T13:20:45Z", "service": "authentication", "level": "error", "info": "JWT validation failed: expired token"}
{"timestamp": "2025-05-16T13:21:02Z", "service": "database", "level": "info", "info": {"query": "SELECT * FROM users", "duration": "45ms"}}
{"timestamp": "2025-05-16T13:21:15Z", "service": "authentication", "level": "warning", "info": {"message": "Rate limit exceeded", "ip": "203.0.113.42"}}
```

# Instructions

1. Filter logs from `authentication` service
2. Show only `warning` and `error` levels
3. Maintain the original structure and order of the logs
4. Output for the above example:
   ```json
   {"timestamp":"2025-05-16T13:20:45Z","level":"error","message":"JWT validation failed: expired token"}
   {"timestamp":"2025-05-16T13:21:15Z","level":"warning","message":"Rate limit exceeded"}
   ```
