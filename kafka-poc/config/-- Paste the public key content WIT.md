\-- Paste the public key content WITHOUT the BEGIN/END lines

\-- Example: if your key file shows:

\--   -----BEGIN PUBLIC KEY-----

\--   MIIBIjANBgkqhki...

\--   ...abc123==

\--   -----END PUBLIC KEY-----

\-- Only paste the middle part (on one line, no spaces):



ALTER USER KAFKA\_CONNECT\_USER SET RSA\_PUBLIC\_KEY='MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv1qacSYV1It81tkXWFXu

ukxS2/HtAIamEIQeGuTbipp8GwCPZHrpkebUZfa5z2NS3uKpu5bnOn1kiKEsEzCQ

ySLkS8KRd4ERP5PMak1rMr3umiH+vhlgq20MYieBNHJQsLTnWrrZWw0iC0S2G0u3

slYMoSxJJ0oiikK79oqVvfYH083eab/ijXlS5qS2AK1pS17okp75MPy1aJc0Z26I

APmzAqFBSrVY6norF5452+UqQ/s4uk+RxBx2a4U3pvMBfG/2Fd2NvAhcenAJJIkf

isDSUfour/z2Ve6toLkZokxVolwrG1zf8aPoLDCVPXwg4hAX/V9YKlFFoFHsl6Js

GwIDAQAB';











**scp -r C:\\Users\\rubar\\Development\\EXL\_POC\\kafka-poc\\rpi5 ubuntu001@ubuntupi:\~/kafka-poc**







**ubuntupi**

**ubuntu001**



**sudo mkdir -p /usr/local/lib/docker/cli-plugins**

**sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64" -o /usr/local/lib/docker/cli-plugins/docker-compose**

**sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose**

**docker compose version**







**docker exec -it mongodb mongosh --eval "rs.status().members\[0].stateStr"**

**# Should print: PRIMARY**



**docker exec -it mongodb mongosh --eval "use poc\_db; db.orders.find().pretty()"**

**# Should show 3 seed documents**





**3530172**

**15642490**

