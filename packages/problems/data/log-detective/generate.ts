// Generates the testcase fixtures of the Log Detective series (problems 51-58).
//
// Every problem in the series shares one access log format:
//
//   <ip> - - [<dd>/<Mon>/<yyyy>:<HH>:<MM>:<SS> +0000] "<METHOD> <path> HTTP/1.1" <status> <bytes> <ms>
//
// The output is deterministic: every testcase uses its own seeded generator,
// and the gzipped logs have no file name or timestamp in their headers. The
// problem configs compute the expected output from the generated files.
//
// Usage, from the repository root:
//
//   pnpm --filter @easyshell/problems exec tsx data/log-detective/generate.ts
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { gzipSync } from "zlib"

const PROBLEMS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "problems",
)

// ---------------------------------------------------------------- utilities

type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(items: ReadonlyArray<T>) => T
  chance: (p: number) => boolean
}

/** mulberry32, a small seeded PRNG. */
function seeded(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)]!,
    chance: (p) => next() < p,
  }
}

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(`fixture check failed: ${message}`)
}

function write(
  slug: string,
  id: number,
  files: Record<string, string | Buffer>,
) {
  const dir = join(PROBLEMS_DIR, slug, "testcases", String(id))
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content)
    const size = Buffer.byteLength(content)
    check(size < 200_000, `${slug}/${id}/${name} is ${size} bytes`)
  }
}

function gzip(text: string): Buffer {
  return gzipSync(Buffer.from(text), { level: 9 })
}

/** Seconds since the epoch, in UTC. Months are 1-based. */
function at(day: number, hour: number, minute = 0, second = 0, month = 11) {
  return Date.UTC(2026, month - 1, day, hour, minute, second) / 1000
}

const pad = (n: number) => String(n).padStart(2, "0")

// ---------------------------------------------------------------- access log

type Req = {
  ip: string
  t: number
  method: string
  path: string
  status: number
  bytes: number
  ms: number
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function stamp(t: number) {
  const d = new Date(t * 1000)
  return `${pad(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`
}

function accessLog(requests: Array<Req>) {
  return requests
    .toSorted((a, b) => a.t - b.t)
    .map(
      (r) =>
        `${r.ip} - - [${stamp(r.t)}] "${r.method} ${r.path} HTTP/1.1" ${r.status} ${r.bytes} ${r.ms}\n`,
    )
    .join("")
}

/** Grandma, the most loyal user of your Twitter clone. */
const GRANDMA = "198.51.100.42"

const USERS = [
  "melon-usk",
  "the-strokes",
  "grandma",
  "captain-shellbeard",
  "kevin",
  "the-intern",
  "senku",
]

const SEARCHES = [
  "melon+usk",
  "is+this+twitter",
  "grandma+cookie+recipe",
  "how+to+exit+vim",
  "rocket",
  "cats",
  "the+strokes+tickets",
  "pirate+jokes",
]

type Route = (r: Rng) => { method: string; path: string; status: number }

const ROUTES: Array<[number, Route]> = [
  [10, () => ({ method: "GET", path: "/", status: 200 })],
  [
    22,
    (r) => ({
      method: "GET",
      path: r.chance(0.5) ? "/api/feed" : `/api/feed?page=${r.int(2, 9)}`,
      status: 200,
    }),
  ],
  [
    14,
    (r) => ({
      method: "GET",
      path: `/api/posts/${r.int(1, 999)}`,
      status: r.chance(0.08) ? 404 : 200,
    }),
  ],
  [5, () => ({ method: "POST", path: "/api/posts", status: 201 })],
  [
    7,
    (r) => ({
      method: "POST",
      path: `/api/posts/${r.int(1, 999)}/like`,
      status: 204,
    }),
  ],
  [
    6,
    (r) => ({
      method: "GET",
      path: `/api/users/${r.pick(USERS)}`,
      status: 200,
    }),
  ],
  [6, () => ({ method: "GET", path: "/api/trending", status: 200 })],
  [
    4,
    (r) => ({
      method: "GET",
      path: `/api/search?q=${r.pick(SEARCHES)}`,
      status: 200,
    }),
  ],
  [5, () => ({ method: "GET", path: "/api/notifications", status: 200 })],
  [
    6,
    (r) => ({
      method: "GET",
      path: "/static/app.js",
      status: r.chance(0.3) ? 304 : 200,
    }),
  ],
  [
    4,
    (r) => ({
      method: "GET",
      path: "/static/style.css",
      status: r.chance(0.3) ? 304 : 200,
    }),
  ],
  [3, () => ({ method: "GET", path: "/favicon.ico", status: 200 })],
  [
    2,
    (r) => ({
      method: "POST",
      path: "/login",
      status: r.chance(0.2) ? 401 : 200,
    }),
  ],
]
const ROUTE_WEIGHT = ROUTES.reduce((sum, [w]) => sum + w, 0)

type ReqOptions = {
  /** Most bodies are 1-48 KB; with smallBytes, most are 100-999 bytes. */
  smallBytes?: boolean
  minMs?: number
  maxMs?: number
}

function bytesFor(r: Rng, status: number, options: ReqOptions) {
  if (status === 204 || status === 304) return 0
  if (options.smallBytes && r.chance(0.7)) return r.int(100, 999)
  return r.int(1000, 48000)
}

function request(r: Rng, ip: string, t: number, options: ReqOptions = {}): Req {
  let roll = r.next() * ROUTE_WEIGHT
  let route = ROUTES[0]![1]
  for (const [weight, candidate] of ROUTES) {
    roll -= weight
    if (roll < 0) {
      route = candidate
      break
    }
  }
  const { method, path, status } = route(r)
  return {
    ip,
    t,
    method,
    path,
    status,
    bytes: bytesFor(r, status, options),
    ms: r.int(options.minMs ?? 3, options.maxMs ?? 400),
  }
}

/** `count` requests at random times in [start, end) from random clients. */
function traffic(
  r: Rng,
  ips: ReadonlyArray<string>,
  start: number,
  end: number,
  count: number,
  options: ReqOptions = {},
): Array<Req> {
  const requests: Array<Req> = []
  for (let i = 0; i < count; i++)
    requests.push(request(r, r.pick(ips), r.int(start, end - 1), options))
  return requests
}

/** `count` copies of a request at random times in [start, end). */
function burst(
  r: Rng,
  count: number,
  start: number,
  end: number,
  make: (t: number, i: number) => Partial<Req> & { ip?: string },
  ips: ReadonlyArray<string> = [],
): Array<Req> {
  const requests: Array<Req> = []
  for (let i = 0; i < count; i++) {
    const t = r.int(start, end - 1)
    const status = 200
    requests.push({
      ip: ips.length > 0 ? r.pick(ips) : "203.0.113.1",
      t,
      method: "GET",
      path: "/",
      status,
      bytes: bytesFor(r, status, {}),
      ms: r.int(3, 400),
      ...make(t, i),
    })
  }
  return requests
}

const IPV4_PREFIXES = [
  "203.0.113.",
  "198.51.100.",
  "192.0.2.",
  "10.0.0.",
  "172.16.4.",
  "192.168.1.",
]

function ipv4Pool(r: Rng, n: number, exclude: ReadonlyArray<string> = []) {
  const pool = new Set<string>()
  while (pool.size < n) {
    const ip = `${r.pick(IPV4_PREFIXES)}${r.int(1, 254)}`
    if (ip !== GRANDMA && !exclude.includes(ip)) pool.add(ip)
  }
  return [...pool]
}

function ipv6Pool(r: Rng, n: number) {
  const hex = () => r.int(1, 0xffff).toString(16)
  const pool = new Set<string>()
  while (pool.size < n) {
    pool.add(
      r.chance(0.5)
        ? `2001:db8:${hex()}::${hex()}`
        : `2001:db8:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`,
    )
  }
  return [...pool]
}

/** Every client makes at least one request, the others are random. */
function everyoneKnocks(
  r: Rng,
  ips: ReadonlyArray<string>,
  start: number,
  end: number,
  count: number,
) {
  return [
    ...ips.map((ip) => request(r, ip, r.int(start, end - 1))),
    ...traffic(r, ips, start, end, count - ips.length),
  ]
}

const fields = (line: string) => line.split(" ")
const lines = (log: string) => log.split("\n").filter(Boolean)

// ---------------------------------------------------------------- 51 who-knocked

function whoKnocked() {
  const slug = "who-knocked"
  const r = seeded(51)
  const night = [at(13, 22), at(14, 8)] as const
  const cases: Array<[number, Array<string>, number]> = [
    [1, ipv4Pool(r, 9), 40],
    [2, ipv4Pool(r, 73), 600],
    [3, [...ipv4Pool(r, 21), ...ipv6Pool(r, 14)], 320],
    [
      4,
      [
        "10.0.0.1",
        "10.0.0.10",
        "10.0.0.100",
        "10.0.0.11",
        "10.0.0.110",
        "192.168.1.2",
        "192.168.1.20",
        "192.168.1.200",
        "192.168.1.21",
        "203.0.113.5",
        "203.0.113.50",
      ],
      160,
    ],
    [5, [GRANDMA], 120],
  ]
  for (const [id, ips, count] of cases) {
    const log = accessLog(everyoneKnocks(r, ips, ...night, count))
    const column = lines(log).map((l) => fields(l)[0])
    check(new Set(column).size === ips.length, `${slug}/${id}: all clients`)
    const runs = column.filter((ip, i) => ip !== column[i - 1]).length
    check(id === 5 || runs !== ips.length, `${slug}/${id}: uniq needs sort`)
    write(slug, id, { "access.log": log })
  }
}

// ---------------------------------------------------------------- 52 status-report

function statusReport() {
  const slug = "status-report"
  const r = seeded(52)
  const ips = ipv4Pool(r, 40)
  const day = [at(14, 9), at(14, 17)] as const
  const errors = (count: number, path: string, status: number) =>
    burst(
      r,
      count,
      ...day,
      () => ({ path, status, bytes: r.int(1000, 1999) }),
      ips,
    )

  write(slug, 1, {
    "access.log": accessLog([
      ...traffic(r, ips, ...day, 46),
      ...errors(1, "/home", 301),
      ...errors(2, "/api/feed", 500),
      ...errors(1, "/api/trending", 503),
    ]),
  })

  write(slug, 2, {
    "access.log": accessLog([
      ...traffic(r, ips, ...day, 480),
      ...errors(3, "/api/feed", 500),
      ...errors(2, "/api/notifications", 502),
      ...errors(1, "/api/trending", 503),
      ...errors(4, "/api/posts", 429),
      ...errors(2, "/home", 301),
      // Grandma's smart kettle found the API.
      ...burst(r, 1, ...day, () => ({
        ip: GRANDMA,
        path: "/api/teapot",
        status: 418,
        bytes: 1418,
      })),
    ]),
  })

  // Small responses: the bytes column is full of three-digit numbers, and so
  // are some paths.
  const tricky = [
    ...traffic(r, ips, ...day, 150, { smallBytes: true }),
    ...burst(
      r,
      3,
      ...day,
      () => ({ path: "/api/posts/200", status: 404, bytes: 200 }),
      ips,
    ),
    ...burst(
      r,
      4,
      ...day,
      () => ({ path: "/api/posts/404", status: 200, bytes: 500 }),
      ips,
    ),
    ...burst(
      r,
      2,
      ...day,
      () => ({ path: "/api/posts/500", status: 200, bytes: 404 }),
      ips,
    ),
    ...errors(2, "/api/feed", 500),
    ...burst(
      r,
      2,
      ...day,
      () => ({ path: "/api/feed?page=301", status: 503, bytes: 301 }),
      ips,
    ),
  ]
  write(slug, 3, { "access.log": accessLog(tricky) })

  // A perfectly healthy day.
  write(slug, 4, {
    "access.log": accessLog(
      traffic(r, ips, ...day, 75).map((req) => ({
        ...req,
        status: 200,
        bytes: req.bytes || r.int(1000, 9000),
      })),
    ),
  })
}

// ---------------------------------------------------------------- 53 rush-hour

/** A request count for every hour of the day, with some noise. */
function curve(r: Rng, base: ReadonlyArray<number>, scale: number) {
  return base.map((n) => Math.max(0, Math.round(n * scale) + r.int(-2, 2)))
}

function hourly(
  r: Rng,
  ips: ReadonlyArray<string>,
  day: number,
  counts: ReadonlyArray<number>,
) {
  return counts.flatMap((count, hour) =>
    traffic(r, ips, at(day, hour), at(day, hour + 1), count),
  )
}

function busiest(log: string) {
  const byHour = new Map<string, number>()
  const bySlot = new Map<string, number>()
  for (const line of lines(log)) {
    const ts = fields(line)[3]!
    const hour = ts.slice(13, 15)
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
    bySlot.set(ts.slice(1, 15), (bySlot.get(ts.slice(1, 15)) ?? 0) + 1)
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()].toSorted((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return { hours: top(byHour), slots: top(bySlot) }
}

// A day of doomscrolling: quiet nights, a lunch break, and the evening couch.
const DAY = [
  4, 3, 2, 1, 1, 2, 4, 7, 9, 8, 7, 9, 12, 11, 8, 8, 9, 11, 13, 16, 19, 22, 17,
  9,
]

function rushHour() {
  const slug = "rush-hour"
  const r = seeded(53)
  const ips = ipv4Pool(r, 50)

  const unique = (id: number, log: string, hour?: string) => {
    const { hours } = busiest(log)
    check(hours[0]![1] !== hours[1]![1], `${slug}/${id}: unique busiest hour`)
    if (hour)
      check(hours[0]![0] === hour, `${slug}/${id}: busiest hour ${hour}`)
    return log
  }

  write(slug, 1, {
    "access.log": unique(
      1,
      accessLog(hourly(r, ips, 13, curve(r, DAY, 1))),
      "21",
    ),
  })

  const lunch = DAY.map((n, h) => (h === 13 ? n + 18 : n))
  write(slug, 2, {
    "access.log": unique(
      2,
      accessLog(hourly(r, ips, 14, curve(r, lunch, 3.5))),
      "13",
    ),
  })

  // Three days. On the second night, Melon Usk posts at 3 a.m. and the
  // busiest single hour of the log is 03:00, but over all days 21:00 wins.
  const multi = [
    ...hourly(r, ips, 13, curve(r, DAY, 2)),
    ...hourly(r, ips, 14, curve(r, DAY, 2)),
    ...hourly(r, ips, 15, curve(r, DAY, 2)),
    ...traffic(r, ips, at(14, 3), at(14, 4), 80),
  ]
  const multiLog = unique(3, accessLog(multi), "21")
  check(
    busiest(multiLog).slots[0]![0].endsWith(":03"),
    `${slug}/3: 3 a.m. spike`,
  )
  write(slug, 3, { "access.log": multiLog })

  // A tie between 09 and 18, spread over two days.
  const day1 = [
    2, 1, 1, 0, 0, 1, 3, 6, 9, 14, 8, 7, 11, 10, 6, 5, 7, 9, 19, 12, 10, 9, 5,
    3,
  ]
  const day2 = [
    3, 2, 1, 1, 0, 1, 2, 7, 10, 17, 9, 6, 12, 9, 7, 6, 8, 10, 12, 13, 11, 8, 6,
    2,
  ]
  const tieLog = accessLog([
    ...hourly(r, ips, 13, day1),
    ...hourly(r, ips, 14, day2),
  ])
  const { hours } = busiest(tieLog)
  check(
    hours[0]![0] === "09" &&
      hours[1]![0] === "18" &&
      hours[0]![1] === hours[1]![1],
    `${slug}/4: tie`,
  )
  check(hours[2]![1] < hours[0]![1], `${slug}/4: only two tied hours`)
  write(slug, 4, { "access.log": tieLog })

  // IPv6 commuters scrolling on the train at 7 a.m.
  const commute = DAY.map((n, h) => (h === 7 ? n + 20 : n))
  const v6 = [...ipv6Pool(r, 30), ...ipv4Pool(r, 10)]
  write(slug, 5, {
    "access.log": unique(
      5,
      accessLog(hourly(r, v6, 14, curve(r, commute, 2))),
      "07",
    ),
  })
}

// ---------------------------------------------------------------- 54 five-hundred-reasons

function fiveHundredReasons() {
  const slug = "five-hundred-reasons"
  const r = seeded(54)
  const ips = ipv4Pool(r, 45)
  const day = [at(14, 10), at(14, 18)] as const
  const errors = (
    count: number,
    path: string | (() => string),
    status: number,
  ) =>
    burst(
      r,
      count,
      ...day,
      () => ({
        path: typeof path === "string" ? path : path(),
        status,
        bytes: r.int(1000, 1999),
        ms: r.int(200, 3000),
      }),
      ips,
    )

  const winner = (
    id: number,
    log: string,
    expected: string,
    ignoringQueries?: string,
  ) => {
    const count = (strip: boolean) => {
      const c = new Map<string, number>()
      for (const line of lines(log)) {
        const f = fields(line)
        if (!f[8]!.startsWith("5")) continue
        const path = strip ? f[6]!.split("?")[0]! : f[6]!
        c.set(path, (c.get(path) ?? 0) + 1)
      }
      return [...c.entries()].toSorted((a, b) => b[1] - a[1])
    }
    const top = count(true)
    check(
      top[0]![0] === expected && top[0]![1] !== top[1]![1],
      `${slug}/${id}: ${expected} wins`,
    )
    if (ignoringQueries)
      check(
        count(false)[0]![0] === ignoringQueries,
        `${slug}/${id}: query trap`,
      )
    return log
  }

  write(slug, 1, {
    "access.log": winner(
      1,
      accessLog([
        ...traffic(r, ips, ...day, 140),
        ...errors(7, "/api/feed", 500),
        ...errors(3, "/api/trending", 503),
        ...errors(1, "/login", 500),
      ]),
      "/api/feed",
    ),
  })

  write(slug, 2, {
    "access.log": winner(
      2,
      accessLog([
        ...traffic(r, ips, ...day, 580),
        ...errors(12, "/api/notifications", 502),
        ...errors(9, () => `/api/feed?page=${r.int(2, 9)}`, 500),
        ...errors(4, "/api/posts", 500),
      ]),
      "/api/notifications",
    ),
  })

  // Every search query is different, so the search endpoint only wins once
  // the query strings are gone.
  const queries = [...SEARCHES, "kevin", "why+is+search+broken"]
  write(slug, 3, {
    "access.log": winner(
      3,
      accessLog([
        ...traffic(r, ips, ...day, 400),
        ...errors(10, () => `/api/search?q=${queries.shift()}`, 500),
        ...errors(6, "/api/upload", 503),
        ...errors(3, "/api/feed", 500),
        ...errors(2, "/api/feed?page=2", 500),
      ]),
      "/api/search",
      "/api/upload",
    ),
  })

  // Lots of 4xx noise from WordPress scanners, plus decoys that contain 500.
  write(slug, 4, {
    "access.log": winner(
      4,
      accessLog([
        ...traffic(r, ips, ...day, 400),
        ...errors(60, "/wp-admin", 404),
        ...errors(35, "/wp-login.php", 404),
        ...errors(25, "/api/admin", 403),
        ...errors(9, "/api/hot-takes", 500),
        ...errors(7, "/api/feed", 503),
        ...errors(2, "/api/notifications", 504),
        ...burst(
          r,
          5,
          ...day,
          () => ({ path: "/api/posts/500", bytes: 500 }),
          ips,
        ),
      ]),
      "/api/hot-takes",
    ),
  })

  // Different flavours of 5xx: /api/upload has the most errors in total,
  // /api/feed has the most plain 500s.
  write(slug, 5, {
    "access.log": winner(
      5,
      accessLog([
        ...traffic(r, ips, ...day, 350),
        ...errors(6, "/api/feed", 500),
        ...errors(3, "/api/upload", 500),
        ...errors(3, "/api/upload", 502),
        ...errors(2, "/api/upload", 504),
        ...errors(4, "/login", 503),
      ]),
      "/api/upload",
    ),
  })
}

// ---------------------------------------------------------------- 55 snail-mail

function snailMail() {
  const slug = "snail-mail"
  const r = seeded(55)
  const ips = ipv4Pool(r, 40)
  const day = [at(14, 9), at(14, 21)] as const

  /** Slow requests, in this order in the log, among the other traffic. */
  const slow = (list: Array<[number, string, string]>) =>
    list.map(([ms, method, path], i) => ({
      ...request(r, r.pick(ips), at(14, 11, 0, 0) + i * 1800),
      method,
      path,
      status: 200,
      bytes: r.int(1000, 48000),
      ms,
    }))

  write(slug, 1, {
    "access.log": accessLog([
      ...traffic(r, ips, ...day, 55, { maxMs: 700 }),
      ...slow([
        [845, "GET", "/api/feed?page=2"],
        [2400, "GET", "/api/trending"],
        [1210, "POST", "/api/posts"],
        [1830, "GET", "/api/search?q=melon+usk"],
        [990, "GET", "/api/users/melon-usk"],
      ]),
    ]),
  })

  // Three requests tie at 4200 ms.
  write(slug, 2, {
    "access.log": accessLog([
      ...traffic(r, ips, ...day, 395, { maxMs: 1500 }),
      ...slow([
        [4200, "GET", "/api/trending"],
        [9001, "GET", "/api/feed?page=9000"],
        [4200, "GET", "/api/feed"],
        [3900, "GET", "/api/search?q=how+to+exit+vim"],
        [4200, "POST", "/api/posts"],
      ]),
    ]),
  })

  // Response times with 3, 4 and 5 digits.
  write(slug, 3, {
    "access.log": accessLog([
      ...traffic(r, ips, ...day, 297, { minMs: 100, maxMs: 999 }),
      ...slow([
        [10500, "GET", "/api/users/melon-usk/followers"],
        [9950, "GET", "/api/trending"],
        [12000, "POST", "/api/upload"],
      ]),
    ]),
  })

  // A quiet day: only three requests.
  write(slug, 4, {
    "access.log": accessLog(
      slow([
        [87, "GET", "/"],
        [1203, "GET", "/api/feed"],
        [450, "POST", "/login"],
      ]),
    ),
  })

  // Four requests tie at 3000 ms, and only two of them make the top 5.
  write(slug, 5, {
    "access.log": accessLog([
      ...traffic(r, ips, ...day, 294, { maxMs: 2000 }),
      ...slow([
        [3000, "GET", "/api/users/kevin"],
        [8000, "GET", "/api/notifications"],
        [3000, "GET", "/api/feed?page=3"],
        [7000, "POST", "/api/posts"],
        [3000, "POST", "/login"],
        [3000, "GET", "/static/app.js"],
      ]),
    ]),
  })
}

// ---------------------------------------------------------------- 56 crime-scene

const APP_LINES: Array<(r: Rng) => string> = [
  (r) => `INFO [feed] served ${r.int(10, 50)} posts in ${r.int(5, 90)}ms`,
  (r) => `INFO [auth] ${r.pick(USERS)} logged in`,
  (r) => `DEBUG [cache] hit ratio ${r.int(60, 99)}%`,
  (r) =>
    `INFO [posts] new post by ${r.pick(USERS)} (${r.int(3, 280)} characters)`,
  (r) => `WARN [db] slow query on posts (${r.int(500, 2000)}ms)`,
  () => `DEBUG [scheduler] tick`,
  (r) => `INFO [likes] ${r.pick(USERS)} liked post ${r.int(1, 999)}`,
  (r) => `WARN [auth] failed login for ${r.pick(USERS)}`,
  (r) =>
    `ERROR [mail] could not send the daily digest to ${r.pick(USERS)}@example.com`,
  (r) =>
    `INFO [search] "${r.pick(SEARCHES).replaceAll("+", " ")}" returned ${r.int(0, 40)} results`,
]

// Each crash comes with the two log lines that explain it.
const INCIDENTS: Array<[string, string, string]> = [
  [
    "WARN [db] connection pool at 10/10",
    "ERROR [db] timed out waiting for a free connection",
    "FATAL [db] connection pool exhausted, shutting down",
  ],
  [
    "INFO [feed] rendering Melon Usk's 47-part thread",
    "WARN [feed] heap at 61/64 MiB",
    "FATAL [feed] out of memory",
  ],
  [
    "INFO [deploy] the intern started a deploy (Friday, 16:58)",
    "WARN [deploy] skipping tests to save time",
    "FATAL [api] config.yaml not found",
  ],
  [
    "WARN [disk] /var/log is 99% full",
    "ERROR [logger] could not write to app.log",
    "FATAL [disk] no space left on device",
  ],
  [
    'INFO [auth] password reset requested for "grandma" from 203.0.113.66',
    "WARN [auth] 400 password resets in 1 minute",
    "FATAL [auth] rate limiter crashed: integer overflow",
  ],
  [
    "INFO [cron] Captain Shellbeard's treasure-map backup started",
    "ERROR [cron] backup is 4 TB, expected 4 MB",
    "FATAL [storage] bucket deleted itself out of shame",
  ],
]

/**
 * An app log of `length` lines with FATAL lines at the given (1-based) line
 * numbers, each preceded by its clues where possible.
 */
function appLog(
  r: Rng,
  length: number,
  fatal: Array<number>,
  extra: Record<number, string> = {},
) {
  const messages = Array.from({ length }, () => r.pick(APP_LINES)(r))
  const offset = r.int(0, INCIDENTS.length - 1)
  for (const [k, n] of fatal.entries()) {
    const [clue1, clue2, crash] = INCIDENTS[(offset + k) % INCIDENTS.length]!
    messages[n - 1] = crash
    if (n >= 2 && !fatal.includes(n - 1)) messages[n - 2] = clue2
    if (n >= 3 && !fatal.includes(n - 2) && !fatal.includes(n - 1))
      messages[n - 3] = clue1
    if (n < length && !fatal.includes(n + 1))
      messages[n] = "INFO [supervisor] restarting the app"
  }
  for (const [n, message] of Object.entries(extra))
    messages[Number(n) - 1] = message
  let t = at(14, 2, 54)
  return messages
    .map((message) => {
      t += r.int(1, 25)
      const d = new Date(t * 1000)
      const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
      const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
      return `${date} ${time} ${message}\n`
    })
    .join("")
}

function crimeScene() {
  const slug = "crime-scene"
  const r = seeded(56)
  const cases: Array<[number, number, Array<number>, Record<number, string>?]> =
    [
      [1, 40, [27]],
      [2, 80, [23, 61]],
      [3, 70, [10, 11, 30, 32, 45, 48, 66]],
      [4, 30, [1, 3, 20]],
      [
        5,
        60,
        [40],
        {
          12: "WARN [auth] non-fatal: token refresh retried",
          15: "INFO [games] Kevin won a round of Mortal Kombat in the break room: FATALITY",
          25: "ERROR [feed] fatal-looking error, but we caught it",
          52: "INFO [supervisor] app restarted, no fatal errors since",
        },
      ],
    ]
  for (const [id, length, fatal, extra] of cases) {
    const log = appLog(r, length, fatal, extra)
    const matches = lines(log).flatMap((l, i) =>
      l.includes("FATAL") ? [i + 1] : [],
    )
    const expected = [...fatal, ...(id === 5 ? [15] : [])].toSorted(
      (a, b) => a - b,
    )
    check(
      matches.join() === expected.join(),
      `${slug}/${id}: FATAL lines ${matches.join()}`,
    )
    write(slug, id, { "app.log": log })
  }
}

// ---------------------------------------------------------------- 57 rotated-and-zipped

const SCANS = [
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/.env",
  "/phpmyadmin",
]

function rotatedAndZipped() {
  const slug = "rotated-and-zipped"
  const r = seeded(57)
  const ips = ipv4Pool(r, 40)
  const scanners = ipv4Pool(r, 3, ips)

  /** One day of logs, `daysAgo` days before 14 Nov. */
  const day = (daysAgo: number, count: number, extra: Array<Req> = []) => {
    const start = at(14 - daysAgo, 0)
    const end = at(15 - daysAgo, 0)
    const scans = burst(
      r,
      r.int(8, 20),
      start,
      end,
      () => ({
        path: r.pick(SCANS),
        status: 404,
        bytes: r.int(1000, 1999),
      }),
      scanners,
    )
    return accessLog([
      ...traffic(r, ips, start, end, count - scans.length),
      ...scans,
      ...extra,
    ])
  }

  const files = (logs: Array<string | null>) => {
    const out: Record<string, string | Buffer> = {}
    logs.forEach((log, i) => {
      if (log === null) return
      if (i === 0) out["access.log"] = log
      else if (i === 1) out["access.log.1"] = log
      else out[`access.log.${i}.gz`] = gzip(log)
    })
    return out
  }

  write(slug, 1, files([day(0, 120), day(1, 120), day(2, 120)]))
  write(
    slug,
    2,
    files([
      day(0, 100),
      day(1, 100),
      day(2, 100),
      day(3, 100),
      day(4, 100),
      day(5, 100),
    ]),
  )
  // logrotate skipped a day: there is no access.log.1.
  write(slug, 3, files([day(0, 120), null, day(2, 120), day(3, 120)]))

  // 404 everywhere except in the status column.
  const decoys = (daysAgo: number) => {
    const start = at(14 - daysAgo, 0)
    const end = at(15 - daysAgo, 0)
    return [
      ...burst(
        r,
        4,
        start,
        end,
        () => ({ path: "/api/posts/404", bytes: r.int(1000, 9999) }),
        ips,
      ),
      ...burst(
        r,
        3,
        start,
        end,
        () => ({ path: "/static/404-cat.png", bytes: 40404 }),
        ips,
      ),
      ...burst(
        r,
        3,
        start,
        end,
        () => ({ path: "/api/feed", bytes: 404 }),
        ips,
      ),
      ...burst(
        r,
        3,
        start,
        end,
        () => ({ path: "/api/trending", ms: 404 }),
        ips,
      ),
    ]
  }
  write(
    slug,
    4,
    files([
      day(0, 110, decoys(0)),
      day(1, 110, decoys(1)),
      day(2, 110, decoys(2)),
    ]),
  )

  // logrotate just ran: access.log is still empty.
  write(slug, 5, files(["", day(1, 120), day(2, 120), day(3, 120)]))
}

// ---------------------------------------------------------------- 58 bot-hunter

function botHunter() {
  const slug = "bot-hunter"
  const r = seeded(58)

  /** `count` requests from `ip` within one calendar minute. */
  const bot = (
    ip: string,
    minute: number,
    count: number,
    first = 0,
    last = 59,
  ) =>
    burst(r, count, minute + first, minute + last + 1, () => ({
      ip,
      path: r.chance(0.7) ? "/api/feed" : `/api/users/${r.pick(USERS)}`,
      ms: r.int(3, 40),
    }))

  /** Grandma refreshes her feed every 20-40 seconds, all night long. */
  const grandma = (start: number, end: number) => {
    const requests: Array<Req> = []
    for (let t = start + r.int(0, 30); t < end; t += r.int(20, 40))
      requests.push({
        ...request(r, GRANDMA, t),
        method: "GET",
        path: "/api/feed",
        status: 200,
      })
    return requests
  }

  const humans = (
    start: number,
    end: number,
    count: number,
    exclude: Array<string>,
  ) => traffic(r, ipv4Pool(r, 50, exclude), start, end, count)

  const bots = (id: number, log: string, expected: Array<string>) => {
    const counts = new Map<string, number>()
    for (const line of lines(log)) {
      const f = fields(line)
      const key = `${f[0]} ${f[3]!.slice(1, 18)}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const found = [
      ...new Set(
        [...counts].filter(([, n]) => n > 20).map(([k]) => k.split(" ")[0]!),
      ),
    ]
    check(
      found.toSorted().join() === expected.toSorted().join(),
      `${slug}/${id}: bots ${found.join()}`,
    )
    const twenty = [...counts.values()].filter((n) => n === 20).length
    check(
      (id === 3) === twenty > 0,
      `${slug}/${id}: exactly 20 only in testcase 3`,
    )
    return log
  }

  const night = [at(14, 3), at(14, 4)] as const

  write(slug, 1, {
    "access.log": bots(
      1,
      accessLog([
        ...humans(...night, 350, ["203.0.113.66"]),
        ...grandma(...night),
        ...bot("203.0.113.66", at(14, 3, 14), 45),
      ]),
      ["203.0.113.66"],
    ),
  })

  const botIps = ["203.0.113.9", "10.0.0.10", "192.0.2.200", "10.0.0.9"]
  write(slug, 2, {
    "access.log": bots(
      2,
      accessLog([
        ...humans(...night, 700, botIps),
        ...grandma(...night),
        ...bot("203.0.113.9", at(14, 3, 5), 35),
        ...bot("203.0.113.9", at(14, 3, 41), 28),
        ...bot("10.0.0.10", at(14, 3, 30), 60),
        ...bot("192.0.2.200", at(14, 3, 59), 22),
        // Busy, but human: 10 requests a minute for 6 minutes.
        ...[0, 1, 2, 3, 4, 5].flatMap((m) =>
          bot("10.0.0.9", at(14, 3, 20 + m), 10),
        ),
      ]),
      ["203.0.113.9", "10.0.0.10", "192.0.2.200"],
    ),
  })

  write(slug, 3, {
    "access.log": bots(
      3,
      accessLog([
        ...humans(...night, 500, ["203.0.113.20", "203.0.113.21"]),
        ...grandma(...night),
        ...bot("203.0.113.20", at(14, 3, 20), 20),
        ...bot("203.0.113.21", at(14, 3, 21), 21),
      ]),
      ["203.0.113.21"],
    ),
  })

  // 30 requests in 35 seconds, but split over two calendar minutes.
  const late = [at(14, 3, 30), at(14, 4, 30)] as const
  write(slug, 4, {
    "access.log": bots(
      4,
      accessLog([
        ...humans(...late, 500, ["198.51.100.30", "198.51.100.7"]),
        ...grandma(...late),
        ...bot("198.51.100.30", at(14, 3, 59), 15, 40, 59),
        ...bot("198.51.100.30", at(14, 4, 0), 15, 0, 15),
        ...bot("198.51.100.7", at(14, 3, 45), 40),
        ...bot("2001:db8:bad::b07", at(14, 4, 10), 25),
      ]),
      ["198.51.100.7", "2001:db8:bad::b07"],
    ),
  })

  // Three nights. 192.0.2.77 reads the news at 03:17 every night.
  write(slug, 5, {
    "access.log": bots(
      5,
      accessLog([
        ...[13, 14, 15].flatMap((d) => [
          ...humans(at(d, 3), at(d, 4), 200, ["192.0.2.77", "203.0.113.250"]),
          ...grandma(at(d, 3), at(d, 4)),
          ...bot("192.0.2.77", at(d, 3, 17), 12),
        ]),
        ...bot("2001:db8:cafe::1", at(14, 3, 33), 24),
        ...bot("203.0.113.250", at(15, 3, 2), 33),
      ]),
      ["2001:db8:cafe::1", "203.0.113.250"],
    ),
  })
}

whoKnocked()
statusReport()
rushHour()
fiveHundredReasons()
snailMail()
crimeScene()
rotatedAndZipped()
botHunter()
console.log("Log Detective fixtures written.")
