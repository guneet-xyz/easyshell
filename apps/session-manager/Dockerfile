FROM alpine:3.21 AS build

RUN apk add --no-cache go

COPY . .

RUN go build

FROM alpine:3.21

RUN apk add --no-cache docker
EXPOSE 4000

COPY --from=build /session-manager /session-manager

ENTRYPOINT ["/session-manager"]

