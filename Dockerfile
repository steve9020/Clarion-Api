# Atlas API — Santa Claus edition.
# One command and it's up. Free for everyone.
FROM node:20-slim

# The three Lazarus programs need their runtimes
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    ruby ruby-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python: clarion-snmp (Ilya Etingof's pysnmp, keeper's edition)
RUN pip3 install --no-cache-dir --break-system-packages clarion-snmp

# Ruby: clarion-builder + clarion-given + rspec (for the prove wrapper)
# rspec-given provides the 'rspec/given' require path used by prove_given.rb
RUN gem install clarion-builder clarion-given rspec rspec-given

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src/ ./src/
COPY scripts/ ./scripts/

EXPOSE 3000
ENV ATLAS_API_PORT=3000

CMD ["node", "src/index.js"]
