#!/usr/bin/env bash
# Issue #24 (MC-E3): deja en el registro de la CI qué condición de la regla de calidad falló, cuántos
# hallazgos hay por severidad y cuáles son los graves y los puntos de seguridad por revisar. El proyecto
# de SonarQube es privado: sin esto, el detalle solo se ve entrando a SonarQube Cloud.
# Es informativo: si la API no responde, avisa y sigue; el resultado del análisis lo decide el paso
# anterior.
set -uo pipefail

API="https://sonarcloud.io/api"
KEY="JuanJo0775_Sistema_valora_F"

# Pide un recurso de la API con el token del secreto SONAR_TOKEN (nunca se imprime).
get() {
  curl -s -f -u "${SONAR_TOKEN}:" "${API}/$1"
}

report() {
  local label="$1" scope="$2" json
  echo "::group::SonarQube: ${label}"
  if json=$(get "qualitygates/project_status?projectKey=${KEY}&${scope}"); then
    echo "${json}" | jq -r '
      "Regla de calidad: \(.projectStatus.status)",
      (.projectStatus.conditions[]? |
        "  \(.status)  \(.metricKey): \(.actualValue // "-") (umbral \(.comparator) \(.errorThreshold))")'
  else
    echo "::warning::No se pudo leer la regla de calidad de ${label}."
  fi
  if json=$(get "issues/search?componentKeys=${KEY}&${scope}&resolved=false&ps=1&facets=severities,types"); then
    echo "${json}" | jq -r '
      "Hallazgos abiertos: \(.total)",
      (.facets[] | "  \(.property): " + ([.values[] | "\(.val)=\(.count)"] | join(", ")))'
  fi
  if json=$(get "issues/search?componentKeys=${KEY}&${scope}&resolved=false&severities=BLOCKER,CRITICAL&ps=100"); then
    echo "${json}" | jq -r '
      "Bloqueantes y críticos: \(.total)",
      (.issues[] | "  [\(.severity)] \(.component | sub("^[^:]*:"; "")):\(.line // "-") \(.message) (\(.rule))")'
  fi
  if json=$(get "issues/search?componentKeys=${KEY}&${scope}&resolved=false&severities=MAJOR,MINOR,INFO&ps=100"); then
    echo "${json}" | jq -r '
      "Mayores, menores e informativos: \(.total)",
      (.issues[] | "  [\(.severity)] \(.component | sub("^[^:]*:"; "")):\(.line // "-") \(.message) (\(.rule))")'
  fi
  if json=$(get "hotspots/search?projectKey=${KEY}&${scope}&status=TO_REVIEW&ps=100"); then
    echo "${json}" | jq -r '
      "Puntos de seguridad por revisar: \(.paging.total)",
      (.hotspots[] | "  \(.component | sub("^[^:]*:"; "")):\(.line // "-") \(.message) (\(.ruleKey))")'
  fi
  echo "::endgroup::"
}

if [[ -n "${PR_NUMBER:-}" ]]; then
  report "pull request #${PR_NUMBER}" "pullRequest=${PR_NUMBER}"
fi
# La rama base del pull request, o la rama que recibió el cambio.
BRANCH="${GITHUB_BASE_REF:-${GITHUB_REF_NAME}}"
report "rama ${BRANCH}" "branch=${BRANCH}"
