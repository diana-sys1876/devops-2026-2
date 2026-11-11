import { mkdirSync, writeFileSync } from "node:fs";

const usuario = "diana-sys1876";
const repositorio = "devops-2026-2";
const rama = "trazabilidad-DianaAyala";
const upstream = "uni-dev-labs";
const numeroPR = 83;

const salida = "docs/timing/evidencias";
mkdirSync(salida, { recursive: true });

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

async function consultar(ruta) {
  const respuesta = await fetch(
    `https://api.github.com${ruta}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "devops-trazabilidad-diana",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }
  );

  if (!respuesta.ok) {
    throw new Error(
      `GitHub API: ${respuesta.status} - ${ruta}`
    );
  }

  return respuesta.json();
}

function duracion(inicio, fin) {
  if (!inicio || !fin) return null;

  return Number(
    ((new Date(fin) - new Date(inicio)) / 1000).toFixed(2)
  );
}

async function buscarRuns(owner, repo, branch) {
  const datos = await consultar(
    `/repos/${owner}/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=20`
  );

  return datos.workflow_runs ?? [];
}

async function analizarRun(run, owner, repo) {
  const datos = await consultar(
    `/repos/${owner}/${repo}/actions/runs/${run.id}/jobs?per_page=100`
  );

  const jobs = (datos.jobs ?? []).map(job => ({
    nombre: job.name,
    estado: job.status,
    conclusion: job.conclusion,
    duracionSegundos: duracion(job.started_at, job.completed_at),
    pasos: (job.steps ?? []).map(paso => ({
      nombre: paso.name,
      conclusion: paso.conclusion,
      duracionSegundos: duracion(
        paso.started_at,
        paso.completed_at
      )
    }))
  }));

  return {
    id: run.id,
    workflow: run.name,
    evento: run.event,
    rama: run.head_branch,
    commit: run.head_sha,
    estado: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
    creado: run.created_at,
    inicio: run.run_started_at,
    actualizado: run.updated_at,
    duracionAproximadaSegundos: duracion(
      run.run_started_at,
      run.updated_at
    ),
    jobs
  };
}

async function ejecutar() {
  console.log("Consultando GitHub Actions...");

  const resultado = {
    fechaConsulta: new Date().toISOString(),
    repositorio: `${usuario}/${repositorio}`,
    rama,
    pullRequestAnterior: null,
    ejecuciones: [],
    observaciones: []
  };

  try {
    const pr = await consultar(
      `/repos/${upstream}/${repositorio}/pulls/${numeroPR}`
    );

    resultado.pullRequestAnterior = {
      numero: pr.number,
      titulo: pr.title,
      estado: pr.state,
      url: pr.html_url,
      ramaOrigen: pr.head.ref,
      commit: pr.head.sha,
      ramaDestino: pr.base.ref
    };

    console.log(`PR #${numeroPR} encontrado.`);
  } catch (error) {
    resultado.observaciones.push(
      `No fue posible consultar PR #${numeroPR}: ${error.message}`
    );
  }

  const fuentes = [
    { owner: usuario, repo: repositorio, branch: rama },
    {
      owner: upstream,
      repo: repositorio,
      branch: rama
    }
  ];

  for (const fuente of fuentes) {
    try {
      const runs = await buscarRuns(
        fuente.owner,
        fuente.repo,
        fuente.branch
      );

      console.log(
        `${fuente.owner}/${fuente.repo}: ${runs.length} ejecuciones encontradas.`
      );

      for (const run of runs.slice(0, 5)) {
        try {
          const detalle = await analizarRun(
            run,
            fuente.owner,
            fuente.repo
          );

          resultado.ejecuciones.push({
            fuente: `${fuente.owner}/${fuente.repo}`,
            ...detalle
          });
        } catch (error) {
          resultado.observaciones.push(
            `No se pudo consultar el run ${run.id}: ${error.message}`
          );
        }
      }
    } catch (error) {
      resultado.observaciones.push(
        `${fuente.owner}/${fuente.repo}: ${error.message}`
      );
    }
  }

  console.log("\nTRAZABILIDAD DE GITHUB ACTIONS");

  if (resultado.ejecuciones.length) {
    console.table(
      resultado.ejecuciones.map(run => ({
        fuente: run.fuente,
        workflow: run.workflow,
        evento: run.evento,
        estado: run.estado,
        resultado: run.conclusion,
        duracionSegundos: run.duracionAproximadaSegundos,
        jobs: run.jobs.length
      }))
    );

    for (const run of resultado.ejecuciones) {
      console.log(`\nRUN: ${run.url}`);

      console.table(
        run.jobs.map(job => ({
          job: job.nombre,
          conclusion: job.conclusion,
          duracionSegundos: job.duracionSegundos
        }))
      );

      for (const job of run.jobs) {
        console.log(`Pasos de ${job.nombre}`);

        console.table(
          job.pasos.map(paso => ({
            paso: paso.nombre,
            conclusion: paso.conclusion,
            duracionSegundos: paso.duracionSegundos
          }))
        );
      }
    }
  } else {
    console.log(
      "No se encontraron ejecuciones accesibles para esta rama."
    );
  }

  if (resultado.observaciones.length) {
    console.log("\nOBSERVACIONES");
    resultado.observaciones.forEach(texto => console.log("-", texto));
  }

  writeFileSync(
    `${salida}/ci-timing.json`,
    JSON.stringify(resultado, null, 2)
  );

  console.log("\nResultados guardados en docs/timing/evidencias/ci-timing.json");
}

await ejecutar();
